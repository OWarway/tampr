import { describe, expect, it, vi } from 'vitest';

import { BlueprintController } from '../../src/background/blueprint-controller';
import type { Snippet } from '../../src/domain/snippets';
import type { RuntimeStatus } from '../../src/runtime/runtime-status';

describe('BlueprintController', () => {
  it('creates a snippet from the active tab picker result', async () => {
    const snippets = new MemorySnippetStore();
    const runtimeSync = vi.fn(async () => readyRuntime());
    const create = vi.fn().mockResolvedValue(undefined);
    const update = vi.fn().mockResolvedValue(undefined);
    const controller = new BlueprintController({
      createId: () => 'blueprint-snippet',
      getExtensionUrl: (path) => `chrome-extension://tampr/${path}`,
      now: () => 1_748_000_000_000,
      runtimeSync,
      scripting: {
        executeScript: vi.fn().mockResolvedValue([
          {
            result: {
              ok: true,
              action: 'hide',
              pick: {
                label: 'Subscribe panel',
                selector: 'aside.subscribe',
                selectorMeta: {
                  matchCount: 1,
                  segmentCount: 1,
                  strategy: 'class',
                  usesNthOfType: false,
                },
                tagName: 'aside',
              },
            },
          },
        ]),
      },
      snippets,
      tabs: {
        create,
        query: vi.fn().mockResolvedValue([
          {
            id: 42,
            url: 'https://docs.example.com/articles/intro?secret=1#comments',
          },
        ]),
        update,
      },
    });

    await expect(controller.startCreator()).resolves.toEqual({
      ok: true,
      snippetId: 'blueprint-snippet',
      status: 'created',
    });
    expect(snippets.values[0]).toMatchObject({
      id: 'blueprint-snippet',
      folder: 'Blueprints',
      name: 'Hide Subscribe panel',
      matches: ['https://docs.example.com/articles/intro*'],
      css: `aside.subscribe {
  display: none !important;
}`,
    });
    expect(runtimeSync).toHaveBeenCalledWith(snippets.values);
    expect(create).toHaveBeenCalledWith({
      url: 'chrome-extension://tampr/workspace.html?sourcePage=https%3A%2F%2Fdocs.example.com%2Farticles%2Fintro&snippet=blueprint-snippet&sourceTab=42',
    });
  });

  it('does not save when the picker is cancelled', async () => {
    const snippets = new MemorySnippetStore();
    const create = vi.fn().mockResolvedValue(undefined);
    const controller = new BlueprintController({
      createId: () => 'blueprint-snippet',
      getExtensionUrl: (path) => `chrome-extension://tampr/${path}`,
      now: () => 1_748_000_000_000,
      runtimeSync: async () => readyRuntime(),
      scripting: {
        executeScript: vi.fn().mockResolvedValue([
          {
            result: {
              ok: false,
              reason: 'cancelled',
              message: 'Blueprint picking was cancelled.',
            },
          },
        ]),
      },
      snippets,
      tabs: {
        create,
        query: vi.fn().mockResolvedValue([
          {
            id: 42,
            url: 'https://docs.example.com/articles/intro',
          },
        ]),
        update: vi.fn(),
      },
    });

    await expect(controller.startCreator()).resolves.toEqual({
      ok: true,
      status: 'cancelled',
    });
    expect(snippets.values).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects unsupported active pages', async () => {
    const controller = new BlueprintController({
      createId: () => 'blueprint-snippet',
      getExtensionUrl: (path) => `chrome-extension://tampr/${path}`,
      now: () => 1_748_000_000_000,
      runtimeSync: async () => readyRuntime(),
      scripting: {
        executeScript: vi.fn(),
      },
      snippets: new MemorySnippetStore(),
      tabs: {
        create: vi.fn(),
        query: vi.fn().mockResolvedValue([
          {
            id: 42,
            url: 'chrome://extensions',
          },
        ]),
        update: vi.fn(),
      },
    });

    await expect(controller.startCreator()).resolves.toEqual({
      ok: false,
      error: 'Blueprint creator works on http and https pages.',
    });
  });

  it('picks a selector from a source tab without creating a snippet', async () => {
    const snippets = new MemorySnippetStore();
    const executeScript = vi.fn().mockResolvedValue([
      {
        result: {
          ok: true,
          pick: {
            label: 'Buy now',
            selector: '[data-testid="buy"]',
            selectorMeta: {
              matchCount: 1,
              segmentCount: 1,
              strategy: 'attribute',
              usesNthOfType: false,
            },
            tagName: 'button',
          },
        },
      },
    ]);
    const update = vi.fn().mockResolvedValue(undefined);
    const controller = new BlueprintController({
      createId: () => 'blueprint-snippet',
      getExtensionUrl: (path) => `chrome-extension://tampr/${path}`,
      now: () => 1_748_000_000_000,
      runtimeSync: async () => readyRuntime(),
      scripting: {
        executeScript,
      },
      snippets,
      tabs: {
        create: vi.fn(),
        query: vi.fn(),
        update,
      },
    });

    await expect(controller.pickSelector(42)).resolves.toEqual({
      ok: true,
      pick: {
        label: 'Buy now',
        selector: '[data-testid="buy"]',
        selectorMeta: {
          matchCount: 1,
          segmentCount: 1,
          strategy: 'attribute',
          usesNthOfType: false,
        },
        tagName: 'button',
      },
      status: 'picked',
    });
    expect(update).toHaveBeenCalledWith(42, { active: true });
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      func: expect.any(Function),
      args: [{ mode: 'selector' }],
    });
    expect(snippets.values).toEqual([]);
  });

  it('does not pick a selector when cancelled', async () => {
    const controller = new BlueprintController({
      createId: () => 'blueprint-snippet',
      getExtensionUrl: (path) => `chrome-extension://tampr/${path}`,
      now: () => 1_748_000_000_000,
      runtimeSync: async () => readyRuntime(),
      scripting: {
        executeScript: vi.fn().mockResolvedValue([
          {
            result: {
              ok: false,
              reason: 'cancelled',
              message: 'Blueprint picking was cancelled.',
            },
          },
        ]),
      },
      snippets: new MemorySnippetStore(),
      tabs: {
        create: vi.fn(),
        query: vi.fn(),
        update: vi.fn(),
      },
    });

    await expect(controller.pickSelector(42)).resolves.toEqual({
      ok: true,
      status: 'cancelled',
    });
  });
});

class MemorySnippetStore {
  constructor(public values: Snippet[] = []) {}

  async save(snippet: Snippet): Promise<Snippet[]> {
    this.values = [...this.values, snippet];
    return this.values;
  }
}

function readyRuntime(): RuntimeStatus {
  return {
    state: 'ready',
    registrations: 1,
    skipped: [],
    errors: [],
  };
}
