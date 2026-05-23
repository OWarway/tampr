import { describe, expect, it } from 'vitest';

import {
  createSnippetExport,
  mergeImportedSnippets,
  parseSnippetExport,
  TAMPR_SNIPPET_EXPORT_FORMAT,
  TAMPR_SNIPPET_EXPORT_VERSION,
} from '../../src/domain/snippet-export';
import {
  buildSnippet,
  SnippetDraftSchema,
  type Snippet,
} from '../../src/domain/snippets';

describe('snippet exports', () => {
  it('creates a versioned Tampr snippet export', () => {
    const snippet = createSnippet('snippet-1');

    expect(
      createSnippetExport({
        now: 1_748_000_000_000,
        snippets: [snippet],
      }),
    ).toEqual({
      format: TAMPR_SNIPPET_EXPORT_FORMAT,
      version: TAMPR_SNIPPET_EXPORT_VERSION,
      exportedAt: 1_748_000_000_000,
      snippets: [snippet],
    });
  });

  it('rejects unsupported import payloads with a user-facing message', () => {
    expect(() => parseSnippetExport({ version: 2, snippets: [] })).toThrow(
      'Import file is not a supported Tampr export.',
    );
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
  css?: string;
  name?: string;
};

function createSnippet(
  id: string,
  { css = 'body { color: blue; }', name = 'Example' }: SnippetOverrides = {},
): Snippet {
  return buildSnippet({
    id,
    now: 1_747_000_000_000,
    draft: SnippetDraftSchema.parse({
      name,
      matches: ['*://example.com/*'],
      css,
    }),
  });
}
