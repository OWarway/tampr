import { describe, expect, it } from 'vitest';

import {
  WorkspaceController,
  type WorkspaceSnippetStore,
} from '../../src/background/workspace-controller';
import {
  buildSnippet,
  SnippetDraftSchema,
  type Snippet,
} from '../../src/domain/snippets';
import type { RuntimeStatus } from '../../src/runtime/runtime-status';

describe('WorkspaceController', () => {
  it('returns current workspace state and syncs the runtime', async () => {
    const snippet = createSnippet('snippet-1');
    const runtimeSync = new RuntimeSync();
    const controller = createController({
      runtimeSync,
      snippets: new MemorySnippetStore([snippet]),
    });

    const response = await controller.handleMessage({
      type: 'workspace/get-state',
    });

    expect(response).toEqual({
      ok: true,
      state: {
        snippets: [snippet],
        runtime: readyRuntime(1),
      },
    });
    expect(runtimeSync.calls).toEqual([[snippet]]);
  });

  it('returns matching page snippets and runtime state', async () => {
    const matchingSnippet = createSnippet('page-match');
    const excludedSnippet = createSnippet('page-excluded', {
      excludeMatches: ['*://example.com/private/*'],
    });
    const controller = createController({
      snippets: new MemorySnippetStore([matchingSnippet, excludedSnippet]),
    });

    const response = await controller.handleMessage({
      type: 'page/get-state',
      pageUrl: 'https://example.com/private/profile',
    });

    expect(response).toEqual({
      ok: true,
      state: {
        pageUrl: 'https://example.com/private/profile',
        savedMatches: [
          {
            enabled: true,
            id: matchingSnippet.id,
            name: matchingSnippet.name,
            rule: '*://example.com/*',
          },
        ],
        enabledMatches: [
          {
            enabled: true,
            id: matchingSnippet.id,
            name: matchingSnippet.name,
            rule: '*://example.com/*',
          },
        ],
        runtime: readyRuntime(2),
      },
    });
  });

  it('saves a new snippet before returning synced state', async () => {
    const snippets = new MemorySnippetStore();
    const runtimeSync = new RuntimeSync();
    const controller = createController({ runtimeSync, snippets });

    const response = await controller.handleMessage({
      type: 'snippets/save',
      draft: {
        name: 'Save proof',
        matches: ['*://example.com/*'],
        css: 'body { color: red; }',
      },
    });

    expect(response.ok).toBe(true);
    expect(snippets.values[0]).toMatchObject({
      id: 'generated-snippet',
      name: 'Save proof',
      updatedAt: 1_748_000_000_000,
    });
    expect(runtimeSync.calls[0]?.[0]).toEqual(snippets.values[0]);
  });

  it('updates existing snippets without changing their identity or creation time', async () => {
    const original = createSnippet('snippet-2');
    const snippets = new MemorySnippetStore([original]);
    const controller = createController({ snippets });

    await controller.handleMessage({
      type: 'snippets/save',
      draft: {
        id: original.id,
        name: 'Updated proof',
        matches: original.matches,
        css: 'body { color: green; }',
      },
    });

    expect(snippets.values[0]).toMatchObject({
      id: original.id,
      name: 'Updated proof',
      createdAt: original.createdAt,
      updatedAt: 1_748_000_000_000,
    });
  });

  it('toggles snippets before returning synced state', async () => {
    const snippet = createSnippet('snippet-toggle');
    const runtimeSync = new RuntimeSync();
    const snippets = new MemorySnippetStore([snippet]);
    const controller = createController({ runtimeSync, snippets });

    const response = await controller.handleMessage({
      type: 'snippets/set-enabled',
      snippetId: snippet.id,
      enabled: false,
    });

    expect(response.ok).toBe(true);
    expect(snippets.values[0]).toMatchObject({
      id: snippet.id,
      enabled: false,
      createdAt: snippet.createdAt,
      updatedAt: 1_748_000_000_000,
    });
    expect(runtimeSync.calls.at(-1)).toEqual([snippets.values[0]]);
  });

  it('removes a snippet before syncing state', async () => {
    const snippet = createSnippet('snippet-3');
    const runtimeSync = new RuntimeSync();
    const controller = createController({
      runtimeSync,
      snippets: new MemorySnippetStore([snippet]),
    });

    const response = await controller.handleMessage({
      type: 'snippets/remove',
      snippetId: snippet.id,
    });

    expect(response).toEqual({
      ok: true,
      state: {
        snippets: [],
        runtime: readyRuntime(0),
      },
    });
    expect(runtimeSync.calls).toEqual([[]]);
  });

  it('rejects unsupported messages', async () => {
    const controller = createController();

    await expect(
      controller.handleMessage({ type: 'tabs/list' }),
    ).resolves.toEqual({
      ok: false,
      error: 'Unsupported Tampr message.',
    });
  });

  it('syncs stored snippets for service-worker lifecycle events', async () => {
    const snippet = createSnippet('snippet-4');
    const runtimeSync = new RuntimeSync();
    const controller = createController({
      runtimeSync,
      snippets: new MemorySnippetStore([snippet]),
    });

    await expect(controller.syncStoredSnippets()).resolves.toEqual(
      readyRuntime(1),
    );
    expect(runtimeSync.calls).toEqual([[snippet]]);
  });
});

type CreateControllerInput = {
  runtimeSync?: RuntimeSync;
  snippets?: MemorySnippetStore;
};

function createController({
  runtimeSync = new RuntimeSync(),
  snippets = new MemorySnippetStore(),
}: CreateControllerInput = {}) {
  return new WorkspaceController({
    createId: () => 'generated-snippet',
    now: () => 1_748_000_000_000,
    runtimeSync: runtimeSync.sync,
    snippets,
  });
}

type SnippetOverrides = {
  excludeMatches?: string[];
};

function createSnippet(id: string, overrides: SnippetOverrides = {}): Snippet {
  return buildSnippet({
    id,
    now: 1_747_000_000_000,
    draft: SnippetDraftSchema.parse({
      name: 'Existing proof',
      matches: ['*://example.com/*'],
      excludeMatches: overrides.excludeMatches,
      css: 'body { color: blue; }',
    }),
  });
}

function readyRuntime(registrations: number): RuntimeStatus {
  return {
    state: 'ready',
    registrations,
    skipped: [],
    errors: [],
  };
}

class RuntimeSync {
  public readonly calls: Snippet[][] = [];

  public readonly sync = async (
    snippets: readonly Snippet[],
  ): Promise<RuntimeStatus> => {
    this.calls.push([...snippets]);
    return readyRuntime(snippets.length);
  };
}

class MemorySnippetStore implements WorkspaceSnippetStore {
  constructor(public values: Snippet[] = []) {}

  async list(): Promise<Snippet[]> {
    return this.values;
  }

  async find(snippetId: string): Promise<Snippet | undefined> {
    return this.values.find((snippet) => snippet.id === snippetId);
  }

  async save(snippet: Snippet): Promise<Snippet[]> {
    this.values = this.values.some((candidate) => candidate.id === snippet.id)
      ? this.values.map((candidate) =>
          candidate.id === snippet.id ? snippet : candidate,
        )
      : [...this.values, snippet];

    return this.values;
  }

  async remove(snippetId: string): Promise<Snippet[]> {
    this.values = this.values.filter((snippet) => snippet.id !== snippetId);
    return this.values;
  }
}
