import { describe, expect, it } from 'vitest';

import { createEmptySnippet } from '../../src/domain/snippets';

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
});
