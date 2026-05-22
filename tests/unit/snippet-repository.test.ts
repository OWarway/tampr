import { describe, expect, it } from 'vitest';

import { buildSnippet, SnippetDraftSchema } from '../../src/domain/snippets';
import {
  SnippetRepository,
  type StorageArea,
} from '../../src/storage/snippet-repository';
import { SNIPPET_STORAGE_KEY } from '../../src/storage/snippet-state';

describe('SnippetRepository', () => {
  it('saves and removes versioned snippets', async () => {
    const storage = new MemoryStorage();
    const repository = new SnippetRepository(storage);
    const snippet = buildSnippet({
      id: 'snippet-1',
      now: 1_748_000_000_000,
      draft: SnippetDraftSchema.parse({
        name: 'Example',
        matches: ['*://example.com/*'],
        css: 'body { color: red; }',
      }),
    });

    await repository.save(snippet);

    expect(await repository.list()).toEqual([snippet]);
    expect(storage.values[SNIPPET_STORAGE_KEY]).toMatchObject({
      version: 1,
      snippets: [snippet],
    });

    await repository.remove(snippet.id);

    expect(await repository.list()).toEqual([]);
  });

  it('rejects invalid stored state instead of overwriting it', async () => {
    const repository = new SnippetRepository(
      new MemoryStorage({
        [SNIPPET_STORAGE_KEY]: { version: 2, snippets: [] },
      }),
    );

    await expect(repository.list()).rejects.toThrow();
  });
});

class MemoryStorage implements StorageArea {
  constructor(public readonly values: Record<string, unknown> = {}) {}

  async get(key: string): Promise<Record<string, unknown>> {
    return { [key]: this.values[key] };
  }

  async set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, items);
  }
}
