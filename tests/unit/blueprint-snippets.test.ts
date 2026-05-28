import { describe, expect, it } from 'vitest';

import {
  BLUEPRINT_SNIPPET_FOLDER,
  buildBlueprintSnippetDraft,
} from '../../src/domain/blueprint-snippets';
import { BLUEPRINT_RECIPE_VERSION } from '../../src/domain/blueprints/recipe';

describe('blueprint snippet drafts', () => {
  it('creates a hide snippet scoped to the current path', () => {
    const selectorMeta = strongSelectorMeta();

    expect(
      buildBlueprintSnippetDraft({
        action: 'hide',
        pageUrl: 'https://docs.example.com/articles/intro?token=private',
        pick: {
          label: 'Subscribe panel',
          selector: 'aside.subscribe',
          selectorMeta,
          tagName: 'aside',
        },
      }),
    ).toEqual({
      name: 'Hide Subscribe panel',
      folder: BLUEPRINT_SNIPPET_FOLDER,
      enabled: true,
      matches: ['https://docs.example.com/articles/intro*'],
      excludeMatches: [],
      css: `aside.subscribe {
  display: none !important;
}`,
      js: '',
      runAt: 'document_idle',
      world: 'USER_SCRIPT',
      blueprint: {
        version: BLUEPRINT_RECIPE_VERSION,
        name: 'Hide Subscribe panel',
        graph: {
          nodes: [
            {
              id: 'hide-selection',
              enabled: true,
              label: 'Hide Subscribe panel',
              selector: 'aside.subscribe',
              selectorMeta,
              type: 'hide',
            },
          ],
          edges: [],
          layout: {
            'hide-selection': { x: 160, y: 120 },
          },
        },
      },
    });
  });

  it('creates a highlight snippet with editable CSS', () => {
    expect(
      buildBlueprintSnippetDraft({
        action: 'highlight',
        pageUrl: 'https://example.com/',
        pick: {
          label: 'Primary button',
          selector: 'main > button.primary',
          selectorMeta: strongSelectorMeta(),
          tagName: 'button',
        },
      }).css,
    ).toBe(`main > button.primary {
  outline: 3px solid #d44d3a !important;
  outline-offset: 3px !important;
}`);
  });

  it('creates overlay removal snippets with readable names', () => {
    const draft = buildBlueprintSnippetDraft({
      action: 'remove-overlay',
      pageUrl: 'https://example.com/',
      pick: {
        label: 'Cookie overlay',
        selector: '[data-testid="cookie-modal"]',
        selectorMeta: strongSelectorMeta(),
        tagName: 'div',
      },
    });

    expect(draft.name).toBe('Remove overlay Cookie overlay');
    expect(draft.blueprint?.graph.nodes[0]?.type).toBe('remove-overlay');
    expect(draft.css).toBe(`[data-testid="cookie-modal"] {
  display: none !important;
  pointer-events: none !important;
}

html,
body {
  overflow: auto !important;
}`);
  });

  it('rejects unsupported page URLs', () => {
    expect(() =>
      buildBlueprintSnippetDraft({
        action: 'hide',
        pageUrl: 'chrome://extensions',
        pick: {
          label: 'Extension details',
          selector: 'main',
          selectorMeta: strongSelectorMeta(),
          tagName: 'main',
        },
      }),
    ).toThrow('Blueprints need an http or https page.');
  });
});

function strongSelectorMeta() {
  return {
    matchCount: 1,
    segmentCount: 1,
    strategy: 'attribute' as const,
    usesNthOfType: false,
  };
}
