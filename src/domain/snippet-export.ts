import { z } from 'zod';

import { SnippetSchema, type Snippet } from './snippets';
import { WebMatchPatternSchema } from './web-match-patterns';

export const TAMPR_SNIPPET_EXPORT_FORMAT = 'tampr.snippets';
export const TAMPR_SNIPPET_EXPORT_VERSION = 1;

const TimestampSchema = z.number().int().nonnegative();

export const SnippetExportSchema = z.object({
  format: z.literal(TAMPR_SNIPPET_EXPORT_FORMAT),
  version: z.literal(TAMPR_SNIPPET_EXPORT_VERSION),
  exportedAt: TimestampSchema,
  snippets: z.array(SnippetSchema),
});

export type SnippetExport = z.infer<typeof SnippetExportSchema>;

const LegacyMvpSnippetSchema = z.object({
  css: z.string().default(''),
  enabled: z.boolean().optional(),
  incognitoOnly: z.boolean().optional(),
  js: z.string().default(''),
  pattern: z.string().default(''),
  updatedAt: TimestampSchema.optional(),
});

const LegacyMvpSnippetMapSchema = z.record(z.string(), LegacyMvpSnippetSchema);

const LegacyMvpExportSchema = z.object({
  exportedAt: z.union([z.iso.datetime(), TimestampSchema]).optional(),
  snippets: LegacyMvpSnippetMapSchema,
  version: z.literal(1).optional(),
});

type CreateSnippetExportInput = {
  now: number;
  snippets: readonly Snippet[];
};

type ParseSnippetImportInput = {
  now: number;
  value: unknown;
};

export function createSnippetExport({
  now,
  snippets,
}: CreateSnippetExportInput): SnippetExport {
  return SnippetExportSchema.parse({
    format: TAMPR_SNIPPET_EXPORT_FORMAT,
    version: TAMPR_SNIPPET_EXPORT_VERSION,
    exportedAt: now,
    snippets,
  });
}

export function parseSnippetExport(value: unknown): SnippetExport {
  const result = SnippetExportSchema.safeParse(value);

  if (!result.success) {
    throw new Error('Import file is not a supported Tampr export.');
  }

  return result.data;
}

export function parseSnippetImport({
  now,
  value,
}: ParseSnippetImportInput): SnippetExport {
  const snippetExport = SnippetExportSchema.safeParse(value);

  if (snippetExport.success) {
    return snippetExport.data;
  }

  const legacyExport = LegacyMvpExportSchema.safeParse(value);

  if (legacyExport.success) {
    return createSnippetExport({
      now: exportedAtToTimestamp(legacyExport.data.exportedAt, now),
      snippets: convertLegacyMvpSnippetMap(legacyExport.data.snippets, now),
    });
  }

  const legacyMap = LegacyMvpSnippetMapSchema.safeParse(value);

  if (legacyMap.success) {
    return createSnippetExport({
      now,
      snippets: convertLegacyMvpSnippetMap(legacyMap.data, now),
    });
  }

  throw new Error('Import file is not a supported Tampr export.');
}

export function mergeImportedSnippets(
  existing: readonly Snippet[],
  imported: readonly Snippet[],
): Snippet[] {
  const snippetsById = new Map<string, Snippet>();

  for (const snippet of existing) {
    snippetsById.set(snippet.id, SnippetSchema.parse(snippet));
  }

  for (const snippet of imported) {
    snippetsById.set(snippet.id, SnippetSchema.parse(snippet));
  }

  return [...snippetsById.values()];
}

function convertLegacyMvpSnippetMap(
  snippetMap: Record<string, z.infer<typeof LegacyMvpSnippetSchema>>,
  now: number,
): Snippet[] {
  return Object.entries(snippetMap).map(([legacyName, legacySnippet]) => {
    const timestamp = legacySnippet.updatedAt ?? now;
    const pattern = legacySnippet.pattern.trim();

    return SnippetSchema.parse({
      id: legacySnippetId(legacyName),
      name: legacySnippetName(legacyName),
      enabled:
        legacySnippet.enabled !== false && legacySnippet.incognitoOnly !== true,
      matches: pattern ? [legacyPatternToWebMatchPattern(pattern)] : [],
      excludeMatches: [],
      css: legacySnippet.css,
      js: legacySnippet.js,
      runAt: 'document_idle',
      world: legacySnippet.js.trim() ? 'MAIN' : 'USER_SCRIPT',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });
}

function legacyPatternToWebMatchPattern(pattern: string): string {
  const normalized = normalizeLegacyPattern(pattern);

  if (!normalized) {
    throw new Error('MVP snippet pattern cannot be converted.');
  }

  const result = WebMatchPatternSchema.safeParse(`*://${normalized}`);

  if (!result.success) {
    throw new Error('MVP snippet pattern cannot be converted.');
  }

  return result.data;
}

function normalizeLegacyPattern(pattern: string): string {
  let nextPattern = pattern.trim();

  if (!nextPattern) {
    return '';
  }

  const schemeIndex = nextPattern.indexOf('://');

  if (schemeIndex !== -1) {
    nextPattern = nextPattern.slice(schemeIndex + 3);
  }

  if (!nextPattern.includes('/')) {
    nextPattern += '/*';
  }

  const pathIndex = nextPattern.indexOf('/');
  const host = nextPattern.slice(0, pathIndex).toLowerCase();
  let path = nextPattern.slice(pathIndex);

  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  if (path.endsWith('/')) {
    path += '*';
  }

  return `${host}${path}`;
}

function legacySnippetName(name: string): string {
  const trimmed = name.trim() || 'Imported snippet';
  return trimmed.slice(0, 120);
}

function legacySnippetId(name: string): string {
  const slug =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 82) || 'snippet';

  return `mvp-${slug}-${stableHash(name)}`.slice(0, 120);
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

function exportedAtToTimestamp(
  exportedAt: number | string | undefined,
  fallback: number,
): number {
  if (typeof exportedAt === 'number') {
    return exportedAt;
  }

  if (typeof exportedAt === 'string') {
    const timestamp = Date.parse(exportedAt);

    if (Number.isFinite(timestamp) && timestamp >= 0) {
      return timestamp;
    }
  }

  return fallback;
}
