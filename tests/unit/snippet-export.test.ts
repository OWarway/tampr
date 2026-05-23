import { describe, expect, it } from 'vitest';

import {
  createSnippetExport,
  mergeImportedSnippets,
  parseSnippetExport,
  parseSnippetImport,
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

  it('parses current Tampr exports through the import boundary', () => {
    const snippet = createSnippet('snippet-1');

    expect(
      parseSnippetImport({
        now: 1_748_000_000_000,
        value: createSnippetExport({
          now: 1_747_000_000_000,
          snippets: [snippet],
        }),
      }),
    ).toMatchObject({
      exportedAt: 1_747_000_000_000,
      snippets: [snippet],
    });
  });

  it('converts MVP exports into v2 snippets', () => {
    const snippetExport = parseSnippetImport({
      now: 1_748_000_000_000,
      value: {
        version: 1,
        exportedAt: '2026-05-23T09:30:00.000Z',
        snippets: {
          'Docs cleanup': {
            pattern: 'HTTPS://Docs.Example.com/articles/',
            css: 'body { color: red; }',
            js: 'window.__tampr = true;',
            enabled: true,
            updatedAt: 1_747_000_000_000,
          },
        },
      },
    });

    expect(snippetExport.exportedAt).toBe(
      Date.parse('2026-05-23T09:30:00.000Z'),
    );
    expect(snippetExport.snippets[0]).toMatchObject({
      id: expect.stringMatching(/^mvp-docs-cleanup-/),
      name: 'Docs cleanup',
      enabled: true,
      matches: ['*://docs.example.com/articles/*'],
      css: 'body { color: red; }',
      js: 'window.__tampr = true;',
      runAt: 'document_idle',
      world: 'MAIN',
      createdAt: 1_747_000_000_000,
      updatedAt: 1_747_000_000_000,
    });
  });

  it('imports MVP snippet maps and disables incognito-only snippets', () => {
    const snippetExport = parseSnippetImport({
      now: 1_748_000_000_000,
      value: {
        'Private helper': {
          pattern: '*.example.com/private/*',
          css: '',
          js: '',
          enabled: true,
          incognitoOnly: true,
        },
      },
    });

    expect(snippetExport.snippets[0]).toMatchObject({
      name: 'Private helper',
      enabled: false,
      matches: ['*://*.example.com/private/*'],
      world: 'USER_SCRIPT',
      createdAt: 1_748_000_000_000,
      updatedAt: 1_748_000_000_000,
    });
  });

  it('rejects MVP snippets with unconvertible non-empty patterns', () => {
    expect(() =>
      parseSnippetImport({
        now: 1_748_000_000_000,
        value: {
          Broken: {
            pattern: 'exa*mple.com/*',
            css: '',
            js: '',
          },
        },
      }),
    ).toThrow('MVP snippet pattern cannot be converted.');
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
