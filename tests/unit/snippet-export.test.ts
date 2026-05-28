import { describe, expect, it } from 'vitest';

import {
  createSnippetExport,
  mergeImportedSnippets,
  parseSnippetExport,
  TAMPR_EXPORT_FORMAT,
  TAMPR_EXPORT_VERSION,
} from '../../src/domain/snippet-export';
import {
  buildSnippet,
  SnippetDraftSchema,
  type Snippet,
} from '../../src/domain/snippets';
import { buildCssBlueprintRecipe } from '../../src/domain/blueprints/recipe';

describe('snippet exports', () => {
  it('creates a versioned Tampr snippet export', () => {
    const snippet = createSnippet('snippet-1');

    expect(
      createSnippetExport({
        now: 1_748_000_000_000,
        snippets: [snippet],
      }),
    ).toEqual({
      data: {
        snippets: [snippet],
      },
      exportedAt: 1_748_000_000_000,
      format: TAMPR_EXPORT_FORMAT,
      version: TAMPR_EXPORT_VERSION,
    });
  });

  it('rejects unsupported import payloads with a user-facing message', () => {
    expect(() => parseSnippetExport({ version: 2, snippets: [] })).toThrow(
      'Import file is not a supported Tampr export.',
    );
  });

  it('parses current Tampr exports through the import boundary', () => {
    const snippet = createSnippet('snippet-1');

    expect(
      parseSnippetExport({
        data: {
          snippets: [snippet],
        },
        exportedAt: 1_747_000_000_000,
        format: TAMPR_EXPORT_FORMAT,
        version: TAMPR_EXPORT_VERSION,
      }),
    ).toMatchObject({
      data: {
        snippets: [snippet],
      },
      exportedAt: 1_747_000_000_000,
    });
  });

  it('keeps blueprint metadata in native exports', () => {
    const blueprint = createBlueprint();
    const snippet = createSnippet('blueprint-snippet', { blueprint });

    expect(
      createSnippetExport({
        now: 1_748_000_000_000,
        snippets: [snippet],
      }).data.snippets[0]?.blueprint,
    ).toEqual(blueprint);
  });

  it('defaults folders when parsing older native exports', () => {
    expect(
      parseSnippetExport({
        data: {
          snippets: [
            {
              id: 'older-snippet',
              name: 'Older snippet',
              enabled: true,
              matches: ['*://example.com/*'],
              excludeMatches: [],
              css: '',
              js: '',
              runAt: 'document_idle',
              world: 'USER_SCRIPT',
              createdAt: 1_747_000_000_000,
              updatedAt: 1_747_000_000_000,
            },
          ],
        },
        exportedAt: 1_747_000_000_000,
        format: TAMPR_EXPORT_FORMAT,
        version: TAMPR_EXPORT_VERSION,
      }),
    ).toMatchObject({
      data: {
        snippets: [
          {
            id: 'older-snippet',
            folder: 'General',
          },
        ],
      },
    });
  });

  it('rejects non-native import shapes', () => {
    expect(() =>
      parseSnippetExport({
        version: 1,
        exportedAt: 1_748_000_000_000,
        snippets: {
          Example: {
            pattern: 'example.com/*',
            css: 'body { color: red; }',
            js: '',
            enabled: true,
          },
        },
      }),
    ).toThrow('Import file is not a supported Tampr export.');
  });

  it('rejects unknown fields in the export envelope', () => {
    const snippet = createSnippet('snippet-1');

    expect(() =>
      parseSnippetExport({
        data: {
          snippets: [snippet],
        },
        exportedAt: 1_747_000_000_000,
        format: TAMPR_EXPORT_FORMAT,
        source: 'unexpected',
        version: TAMPR_EXPORT_VERSION,
      }),
    ).toThrow('Import file is not a supported Tampr export.');
  });

  it('merges imported snippets by stable id', () => {
    const kept = createSnippet('keep');
    const replaced = createSnippet('replace', { name: 'Old name' });
    const importedReplacement = createSnippet('replace', {
      css: 'body { color: green; }',
      name: 'Imported name',
    });
    const importedNew = createSnippet('new');

    expect(
      mergeImportedSnippets(
        [kept, replaced],
        [importedReplacement, importedNew],
      ),
    ).toEqual([kept, importedReplacement, importedNew]);
  });
});

type SnippetOverrides = {
  blueprint?: ReturnType<typeof createBlueprint>;
  css?: string;
  folder?: string;
  name?: string;
};

function createSnippet(
  id: string,
  {
    blueprint,
    css = 'body { color: blue; }',
    folder = 'General',
    name = 'Example',
  }: SnippetOverrides = {},
): Snippet {
  return buildSnippet({
    id,
    now: 1_747_000_000_000,
    draft: SnippetDraftSchema.parse({
      name,
      folder,
      matches: ['*://example.com/*'],
      css,
      blueprint,
    }),
  });
}

function createBlueprint() {
  return buildCssBlueprintRecipe({
    id: 'hide-selection',
    label: 'Hide Subscribe panel',
    selector: 'aside.subscribe',
    selectorMeta: {
      matchCount: 1,
      segmentCount: 1,
      strategy: 'attribute',
      usesNthOfType: false,
    },
    type: 'hide',
  });
}
