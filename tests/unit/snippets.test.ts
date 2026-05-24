import { describe, expect, it } from 'vitest';

import {
  buildSnippet,
  createEmptySnippet,
  SnippetDraftSchema,
} from '../../src/domain/snippets';

describe('createEmptySnippet', () => {
  it('creates a safe local snippet default', () => {
    expect(
      createEmptySnippet({
        id: 'snippet-1',
        now: 1_748_000_000_000,
      }),
    ).toEqual({
      id: 'snippet-1',
      name: 'Untitled snippet',
      folder: 'General',
      enabled: true,
      matches: [],
      excludeMatches: [],
      css: '',
      js: '',
      runAt: 'document_idle',
      world: 'USER_SCRIPT',
      createdAt: 1_748_000_000_000,
      updatedAt: 1_748_000_000_000,
    });
  });

  it('preserves the initial name', () => {
    const snippet = createEmptySnippet({
      id: 'snippet-2',
      name: 'Current page focus',
      now: 1_748_000_000_001,
    });

    expect(snippet.name).toBe('Current page focus');
  });

  it('builds a runtime snippet from a validated draft', () => {
    const draft = SnippetDraftSchema.parse({
      name: 'Example highlight',
      enabled: true,
      matches: ['*://Example.com/*'],
      excludeMatches: [],
      css: 'main { outline: 1px solid red; }',
      js: '',
      runAt: 'document_start',
      world: 'USER_SCRIPT',
    });

    const snippet = buildSnippet({
      draft,
      id: 'snippet-3',
      now: 1_748_000_000_002,
    });

    expect(snippet.matches).toEqual(['*://example.com/*']);
    expect(snippet.folder).toBe('General');
    expect(snippet.runAt).toBe('document_start');
  });

  it('trims custom folders from drafts', () => {
    const snippet = buildSnippet({
      draft: SnippetDraftSchema.parse({
        name: 'Example highlight',
        folder: '  Workflows  ',
        matches: ['*://example.com/*'],
        css: '',
      }),
      id: 'snippet-4',
      now: 1_748_000_000_003,
    });

    expect(snippet.folder).toBe('Workflows');
  });

  it('returns empty folders to the default group', () => {
    const draft = SnippetDraftSchema.parse({
      name: 'Example highlight',
      folder: '   ',
      matches: ['*://example.com/*'],
      css: '',
    });

    expect(draft.folder).toBe('General');
  });
});
