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

  it('creates a snippet from a page-side Blueprint draft flow', async () => {
    const snippets = new MemorySnippetStore();
    const runtimeSync = vi.fn(async () => readyRuntime());
    const create = vi.fn().mockResolvedValue(undefined);
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
              action: 'click',
              pick: {
                label: 'Open panel',
                selector: 'button[data-testid="open"]',
                selectorMeta: selectorMeta(),
                tagName: 'button',
              },
              draft: {
                nodes: [
                  {
                    action: 'click',
                    pick: {
                      label: 'Open panel',
                      selector: 'button[data-testid="open"]',
                      selectorMeta: selectorMeta(),
                      tagName: 'button',
                    },
                  },
                  {
                    action: 'custom-code',
                    code: 'values.opened = true;',
                    pick: {
                      label: 'Panel',
                      selector: '[data-testid="panel"]',
                      selectorMeta: selectorMeta(),
                      tagName: 'section',
                    },
                  },
                ],
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
        update: vi.fn(),
      },
    });

    await expect(controller.startCreator()).resolves.toEqual({
      ok: true,
      snippetId: 'blueprint-snippet',
      status: 'created',
    });
    expect(snippets.values[0]).toMatchObject({
      folder: 'Blueprints',
      name: 'Click Open panel + 1 steps',
      js: expect.stringContaining('values.opened = true;'),
    });
    expect(snippets.values[0]?.blueprint?.graph.nodes).toEqual([
      expect.objectContaining({
        id: 'click-step-1',
        type: 'click',
      }),
      expect.objectContaining({
        id: 'custom-code-step-2',
        type: 'custom-code',
      }),
    ]);
    expect(runtimeSync).toHaveBeenCalledWith(snippets.values);
    expect(create).toHaveBeenCalled();
  });

  it('reinjects an active Blueprint draft after navigation completes', async () => {
    const snippets = new MemorySnippetStore();
    const runtimeSync = vi.fn(async () => readyRuntime());
    const create = vi.fn().mockResolvedValue(undefined);
    const draft = {
      nodes: [
        {
          action: 'click' as const,
          pick: {
            label: 'Next',
            selector: 'a.next',
            selectorMeta: selectorMeta(),
            tagName: 'a',
          },
        },
      ],
    };
    const executeScript = vi
      .fn()
      .mockResolvedValueOnce([
        {
          result: {
            ok: false,
            reason: 'navigating',
            message: 'Blueprint editor will continue after navigation.',
            draft,
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          result: {
            ok: true,
            pick: draft.nodes[0]?.pick,
            draft,
          },
        },
      ]);
    const controller = new BlueprintController({
      createId: () => 'blueprint-snippet',
      getExtensionUrl: (path) => `chrome-extension://tampr/${path}`,
      now: () => 1_748_000_000_000,
      runtimeSync,
      scripting: {
        executeScript,
      },
      snippets,
      tabs: {
        create,
        query: vi.fn().mockResolvedValue([
          {
            id: 42,
            url: 'https://docs.example.com/start',
          },
        ]),
        update: vi.fn(),
      },
    });

    await expect(controller.startCreator()).resolves.toEqual({
      ok: true,
      status: 'continued',
    });

    await controller.handleTabUpdated(
      42,
      { status: 'complete' },
      { url: 'https://docs.example.com/next' },
    );

    expect(executeScript).toHaveBeenNthCalledWith(2, {
      target: { tabId: 42 },
      func: expect.any(Function),
      args: [{ draft }],
    });
    expect(snippets.values[0]).toMatchObject({
      folder: 'Blueprints',
      matches: ['https://docs.example.com/next*'],
      name: 'Click Next',
    });
    expect(runtimeSync).toHaveBeenCalledWith(snippets.values);
    expect(create).toHaveBeenCalledWith({
      url: 'chrome-extension://tampr/workspace.html?sourcePage=https%3A%2F%2Fdocs.example.com%2Fnext&snippet=blueprint-snippet&sourceTab=42',
    });
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

  it('tests a selector against the source tab without activating it', async () => {
    const executeScript = vi.fn().mockResolvedValue([
      {
        result: {
          ok: true,
          result: {
            firstTagName: 'button',
            matchCount: 2,
            visibleCount: 1,
          },
        },
      },
    ]);
    const update = vi.fn();
    const controller = new BlueprintController({
      createId: () => 'blueprint-snippet',
      getExtensionUrl: (path) => `chrome-extension://tampr/${path}`,
      now: () => 1_748_000_000_000,
      runtimeSync: async () => readyRuntime(),
      scripting: {
        executeScript,
      },
      snippets: new MemorySnippetStore(),
      tabs: {
        create: vi.fn(),
        query: vi.fn(),
        update,
      },
    });

    await expect(
      controller.testSelector(42, 'button[data-testid="buy"]'),
    ).resolves.toEqual({
      ok: true,
      result: {
        firstTagName: 'button',
        matchCount: 2,
        visibleCount: 1,
      },
    });
    expect(update).not.toHaveBeenCalled();
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      func: expect.any(Function),
      args: [{ selector: 'button[data-testid="buy"]' }],
    });
  });

  it('tests an automation node against the source tab without activating it', async () => {
    const executeScript = vi.fn().mockResolvedValue([
      {
        result: {
          ok: true,
          result: {
            action: 'click',
            firstTagName: 'button',
            issues: [],
            matchCount: 1,
            preview: 'Open deal',
            ready: true,
            visibleCount: 1,
          },
        },
      },
    ]);
    const update = vi.fn();
    const controller = new BlueprintController({
      createId: () => 'blueprint-snippet',
      getExtensionUrl: (path) => `chrome-extension://tampr/${path}`,
      now: () => 1_748_000_000_000,
      runtimeSync: async () => readyRuntime(),
      scripting: {
        executeScript,
      },
      snippets: new MemorySnippetStore(),
      tabs: {
        create: vi.fn(),
        query: vi.fn(),
        update,
      },
    });

    await expect(
      controller.testAutomationNode(42, {
        type: 'click',
        selector: 'button[data-testid="deal"]',
        requireVisible: true,
      }),
    ).resolves.toEqual({
      ok: true,
      result: {
        action: 'click',
        firstTagName: 'button',
        issues: [],
        matchCount: 1,
        preview: 'Open deal',
        ready: true,
        visibleCount: 1,
      },
    });
    expect(update).not.toHaveBeenCalled();
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      func: expect.any(Function),
      args: [
        {
          type: 'click',
          selector: 'button[data-testid="deal"]',
          requireVisible: true,
        },
      ],
    });
  });

  it('runs a supported automation node against the source tab without activating it', async () => {
    const executeScript = vi.fn().mockResolvedValue([
      {
        result: {
          ok: true,
          result: {
            action: 'extract-text',
            durationMs: 12,
            firstTagName: 'section',
            matchCount: 1,
            message: 'Text extracted from the source page.',
            preview: 'Deal',
            value: 'Deal',
            variableName: 'dealText',
            visibleCount: 1,
          },
        },
      },
    ]);
    const update = vi.fn();
    const controller = new BlueprintController({
      createId: () => 'blueprint-snippet',
      getExtensionUrl: (path) => `chrome-extension://tampr/${path}`,
      now: () => 1_748_000_000_000,
      runtimeSync: async () => readyRuntime(),
      scripting: {
        executeScript,
      },
      snippets: new MemorySnippetStore(),
      tabs: {
        create: vi.fn(),
        query: vi.fn(),
        update,
      },
    });

    await expect(
      controller.runAutomationNode(42, {
        type: 'extract-text',
        selector: 'section[data-testid="deal"]',
        requireVisible: true,
        timeoutMs: 5000,
        variableName: 'dealText',
      }),
    ).resolves.toEqual({
      ok: true,
      result: {
        action: 'extract-text',
        durationMs: 12,
        firstTagName: 'section',
        matchCount: 1,
        message: 'Text extracted from the source page.',
        preview: 'Deal',
        value: 'Deal',
        variableName: 'dealText',
        visibleCount: 1,
      },
    });
    expect(update).not.toHaveBeenCalled();
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      func: expect.any(Function),
      args: [
        {
          type: 'extract-text',
          selector: 'section[data-testid="deal"]',
          requireVisible: true,
          timeoutMs: 5000,
          variableName: 'dealText',
        },
      ],
    });
  });

  it('passes explicit click confirmation to automation node runs', async () => {
    const executeScript = vi.fn().mockResolvedValue([
      {
        result: {
          ok: true,
          result: {
            action: 'click',
            durationMs: 9,
            firstTagName: 'button',
            matchCount: 1,
            message: 'Element clicked on the source page.',
            preview: 'Open panel',
            visibleCount: 1,
          },
        },
      },
    ]);
    const controller = new BlueprintController({
      createId: () => 'blueprint-snippet',
      getExtensionUrl: (path) => `chrome-extension://tampr/${path}`,
      now: () => 1_748_000_000_000,
      runtimeSync: async () => readyRuntime(),
      scripting: {
        executeScript,
      },
      snippets: new MemorySnippetStore(),
      tabs: {
        create: vi.fn(),
        query: vi.fn(),
        update: vi.fn(),
      },
    });

    await expect(
      controller.runAutomationNode(42, {
        type: 'click',
        selector: 'button[data-testid="open"]',
        confirmAction: true,
        requireVisible: true,
        timeoutMs: 5000,
      }),
    ).resolves.toEqual({
      ok: true,
      result: {
        action: 'click',
        durationMs: 9,
        firstTagName: 'button',
        matchCount: 1,
        message: 'Element clicked on the source page.',
        preview: 'Open panel',
        visibleCount: 1,
      },
    });
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      func: expect.any(Function),
      args: [
        {
          type: 'click',
          selector: 'button[data-testid="open"]',
          confirmAction: true,
          requireVisible: true,
          timeoutMs: 5000,
        },
      ],
    });
  });

  it('cancels an automation run on the source tab', async () => {
    const executeScript = vi.fn().mockResolvedValue([
      {
        result: {
          ok: true,
        },
      },
    ]);
    const controller = new BlueprintController({
      createId: () => 'blueprint-snippet',
      getExtensionUrl: (path) => `chrome-extension://tampr/${path}`,
      now: () => 1_748_000_000_000,
      runtimeSync: async () => readyRuntime(),
      scripting: {
        executeScript,
      },
      snippets: new MemorySnippetStore(),
      tabs: {
        create: vi.fn(),
        query: vi.fn(),
        update: vi.fn(),
      },
    });

    await expect(
      controller.cancelAutomationRun(42, 'run-test'),
    ).resolves.toEqual({
      ok: true,
      status: 'cancelled',
    });
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      func: expect.any(Function),
      args: [{ runId: 'run-test' }],
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

function selectorMeta() {
  return {
    matchCount: 1,
    segmentCount: 1,
    strategy: 'attribute' as const,
    usesNthOfType: false,
  };
}
