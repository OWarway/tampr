import { z } from 'zod';

import { SnippetSchema, type Snippet } from './snippets';

export const TAMPR_EXPORT_FORMAT = 'tampr';
export const TAMPR_EXPORT_VERSION = 1;

const TimestampSchema = z.number().int().nonnegative();

export const SnippetExportSchema = z
  .object({
    data: z
      .object({
        snippets: z.array(SnippetSchema),
      })
      .strict(),
    exportedAt: TimestampSchema,
    format: z.literal(TAMPR_EXPORT_FORMAT),
    version: z.literal(TAMPR_EXPORT_VERSION),
  })
  .strict();

export type SnippetExport = z.infer<typeof SnippetExportSchema>;

type CreateSnippetExportInput = {
  now: number;
  snippets: readonly Snippet[];
};

export function createSnippetExport({
  now,
  snippets,
}: CreateSnippetExportInput): SnippetExport {
  return SnippetExportSchema.parse({
    data: {
      snippets,
    },
    exportedAt: now,
    format: TAMPR_EXPORT_FORMAT,
    version: TAMPR_EXPORT_VERSION,
  });
}

export function parseSnippetExport(value: unknown): SnippetExport {
  const result = SnippetExportSchema.safeParse(value);

  if (!result.success) {
    throw new Error('Import file is not a supported Tampr export.');
  }

  return result.data;
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
