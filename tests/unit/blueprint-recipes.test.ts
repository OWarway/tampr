import { describe, expect, it } from 'vitest';

import {
  compileBlueprintJavaScript,
  compileBlueprintCss,
  isBlueprintCssInSync,
  isBlueprintJavaScriptInSync,
} from '../../src/domain/blueprints/compiler';
import type { BlueprintCssAction } from '../../src/domain/blueprints/actions';
import {
  BLUEPRINT_RECIPE_VERSION,
  BlueprintRecipeSchema,
  buildCssBlueprintRecipe,
  getLinearBlueprintNodes,
  insertBlueprintNode,
  moveBlueprintNode,
  removeBlueprintNode,
  updateBlueprintNode,
  type BlueprintNodeType,
  type BlueprintRecipe,
} from '../../src/domain/blueprints/recipe';

describe('blueprint recipes', () => {
  it('builds graph-shaped recipes for current CSS actions', () => {
    expect(
      buildCssBlueprintRecipe({
        id: 'hide-selection',
        label: 'Hide Subscribe panel',
        selector: 'aside.subscribe',
        selectorMeta: selectorMeta(),
        type: 'hide',
      }),
    ).toEqual({
      version: BLUEPRINT_RECIPE_VERSION,
      name: 'Hide Subscribe panel',
      graph: {
        nodes: [
          {
            id: 'hide-selection',
            enabled: true,
            label: 'Hide Subscribe panel',
            selector: 'aside.subscribe',
            selectorMeta: selectorMeta(),
            type: 'hide',
          },
        ],
        edges: [],
        layout: {
          'hide-selection': { x: 160, y: 120 },
        },
      },
    });
  });

  it('compiles enabled nodes in linear graph order', () => {
    expect(compileBlueprintCss(twoNodeRecipe())).toBe(`aside.subscribe {
  display: none !important;
}

main > button.primary {
  outline: 3px solid #d44d3a !important;
  outline-offset: 3px !important;
}`);
  });

  it.each([
    [
      'hide',
      `main > .target {
  display: none !important;
}`,
    ],
    [
      'highlight',
      `main > .target {
  outline: 3px solid #d44d3a !important;
  outline-offset: 3px !important;
}`,
    ],
    [
      'remove-overlay',
      `main > .target {
  display: none !important;
  pointer-events: none !important;
}

html,
body {
  overflow: auto !important;
}`,
    ],
    [
      'sticky',
      `main > .target {
  position: sticky !important;
  top: 0 !important;
  z-index: 2147483646 !important;
}`,
    ],
    [
      'widen',
      `main > .target {
  max-width: none !important;
  width: min(100%, 1200px) !important;
}`,
    ],
    [
      'print-cleanup',
      `@media print {
  main > .target {
    display: none !important;
  }
}`,
    ],
  ] satisfies Array<[BlueprintCssAction, string]>)(
    'compiles %s CSS nodes',
    (type, expectedCss) => {
      expect(
        compileBlueprintCss(
          buildCssBlueprintRecipe({
            id: `${type}-selection`,
            label: 'Target action',
            selector: 'main > .target',
            selectorMeta: selectorMeta(),
            type,
          }),
        ),
      ).toBe(expectedCss);
    },
  );

  it('skips disabled nodes when compiling CSS', () => {
    const recipe = twoNodeRecipe({
      firstEnabled: false,
    });

    expect(compileBlueprintCss(recipe)).toBe(`main > button.primary {
  outline: 3px solid #d44d3a !important;
  outline-offset: 3px !important;
}`);
  });

  it('returns nodes in the validated straight-line path', () => {
    expect(
      getLinearBlueprintNodes(twoNodeRecipe()).map((node) => node.id),
    ).toEqual(['hide-selection', 'highlight-selection']);
  });

  it('updates node metadata through the recipe schema', () => {
    const recipe = updateBlueprintNode(twoNodeRecipe(), 'hide-selection', {
      enabled: false,
      label: 'Hide signup panel',
      selector: 'aside.new-signup',
      selectorMeta: selectorMeta(),
      type: 'print-cleanup',
    });

    expect(recipe.graph.nodes[0]).toMatchObject({
      enabled: false,
      label: 'Hide signup panel',
      selector: 'aside.new-signup',
      type: 'print-cleanup',
    });
    expect(compileBlueprintCss(recipe)).toBe(`main > button.primary {
  outline: 3px solid #d44d3a !important;
  outline-offset: 3px !important;
}`);
  });

  it('inserts nodes after an existing node in the straight-line graph', () => {
    const { nodeId, recipe } = insertBlueprintNode(twoNodeRecipe(), {
      afterNodeId: 'hide-selection',
      selector: 'aside.subscribe',
      selectorMeta: selectorMeta(),
      type: 'print-cleanup',
    });

    expect(nodeId).toBe('print-cleanup-selection');
    expect(getLinearBlueprintNodes(recipe).map((node) => node.id)).toEqual([
      'hide-selection',
      'print-cleanup-selection',
      'highlight-selection',
    ]);
    expect(recipe.graph.edges).toEqual([
      {
        id: 'edge-print-cleanup-selection',
        fromNodeId: 'hide-selection',
        fromPort: 'success',
        toNodeId: 'print-cleanup-selection',
      },
      {
        id: 'edge-highlight-selection',
        fromNodeId: 'print-cleanup-selection',
        fromPort: 'success',
        toNodeId: 'highlight-selection',
      },
    ]);
    expect(compileBlueprintCss(recipe)).toContain('@media print');
  });

  it('deduplicates generated node IDs when inserting repeated actions', () => {
    const first = insertBlueprintNode(twoNodeRecipe(), {
      afterNodeId: 'hide-selection',
      selector: 'aside.subscribe',
      selectorMeta: selectorMeta(),
      type: 'highlight',
    });
    const second = insertBlueprintNode(first.recipe, {
      afterNodeId: first.nodeId,
      selector: 'aside.subscribe',
      selectorMeta: selectorMeta(),
      type: 'highlight',
    });

    expect(
      getLinearBlueprintNodes(second.recipe).map((node) => node.id),
    ).toEqual([
      'hide-selection',
      'highlight-selection-2',
      'highlight-selection-3',
      'highlight-selection',
    ]);
  });

  it('removes nodes and reconnects the straight-line graph', () => {
    const { recipe } = insertBlueprintNode(twoNodeRecipe(), {
      afterNodeId: 'hide-selection',
      selector: 'aside.subscribe',
      selectorMeta: selectorMeta(),
      type: 'print-cleanup',
    });
    const updated = removeBlueprintNode(recipe, 'print-cleanup-selection');

    expect(getLinearBlueprintNodes(updated).map((node) => node.id)).toEqual([
      'hide-selection',
      'highlight-selection',
    ]);
    expect(updated.graph.edges).toEqual([
      {
        id: 'edge-highlight-selection',
        fromNodeId: 'hide-selection',
        fromPort: 'success',
        toNodeId: 'highlight-selection',
      },
    ]);
  });

  it('moves nodes and rewires the straight-line graph', () => {
    const { recipe } = insertBlueprintNode(twoNodeRecipe(), {
      afterNodeId: 'hide-selection',
      selector: 'aside.subscribe',
      selectorMeta: selectorMeta(),
      type: 'print-cleanup',
    });
    const updated = moveBlueprintNode(recipe, 'highlight-selection', 'up');

    expect(getLinearBlueprintNodes(updated).map((node) => node.id)).toEqual([
      'hide-selection',
      'highlight-selection',
      'print-cleanup-selection',
    ]);
    expect(updated.graph.edges).toEqual([
      {
        id: 'edge-highlight-selection',
        fromNodeId: 'hide-selection',
        fromPort: 'success',
        toNodeId: 'highlight-selection',
      },
      {
        id: 'edge-print-cleanup-selection',
        fromNodeId: 'highlight-selection',
        fromPort: 'success',
        toNodeId: 'print-cleanup-selection',
      },
    ]);
    expect(updated.graph.layout).toEqual({
      'hide-selection': { x: 0, y: 0 },
      'highlight-selection': { x: 220, y: 0 },
      'print-cleanup-selection': { x: 440, y: 0 },
    });
  });

  it('leaves boundary node moves unchanged', () => {
    const recipe = twoNodeRecipe();

    expect(moveBlueprintNode(recipe, 'hide-selection', 'up')).toBe(recipe);
    expect(moveBlueprintNode(recipe, 'highlight-selection', 'down')).toBe(
      recipe,
    );
  });

  it('keeps at least one node in every recipe', () => {
    expect(() =>
      removeBlueprintNode(
        buildCssBlueprintRecipe({
          id: 'hide-selection',
          label: 'Hide panel',
          selector: 'aside.subscribe',
          selectorMeta: selectorMeta(),
          type: 'hide',
        }),
        'hide-selection',
      ),
    ).toThrow('Blueprints need at least one node.');
  });

  it('detects when generated CSS still matches the recipe', () => {
    const recipe = twoNodeRecipe();

    expect(isBlueprintCssInSync(recipe, compileBlueprintCss(recipe))).toBe(
      true,
    );
    expect(
      isBlueprintCssInSync(recipe, `${compileBlueprintCss(recipe)}\n\n`),
    ).toBe(true);
    expect(isBlueprintCssInSync(recipe, 'main { color: red; }')).toBe(false);
  });

  it('parses automation nodes with guarded defaults', () => {
    const recipe = BlueprintRecipeSchema.parse({
      version: BLUEPRINT_RECIPE_VERSION,
      name: 'Click flow',
      graph: {
        nodes: [
          node('wait-for-buy', 'wait-for-element', 'button.buy'),
          node('click-buy', 'click', 'button.buy'),
          {
            ...node('extract-total', 'extract-text', '.total'),
            variableName: 'total',
          },
          node('download-total', 'download-json', 'body'),
        ],
        edges: [
          edge('edge-click-buy', 'wait-for-buy', 'click-buy'),
          edge('edge-extract-total', 'click-buy', 'extract-total'),
          edge('edge-download-total', 'extract-total', 'download-total'),
        ],
        layout: {
          'wait-for-buy': { x: 0, y: 0 },
          'click-buy': { x: 220, y: 0 },
          'extract-total': { x: 440, y: 0 },
          'download-total': { x: 660, y: 0 },
        },
      },
    });

    expect(recipe.graph.nodes).toEqual([
      expect.objectContaining({
        id: 'wait-for-buy',
        requireVisible: true,
        timeoutMs: 5000,
        type: 'wait-for-element',
      }),
      expect.objectContaining({
        id: 'click-buy',
        requireVisible: true,
        timeoutMs: 5000,
        type: 'click',
      }),
      expect.objectContaining({
        id: 'extract-total',
        requireVisible: true,
        timeoutMs: 5000,
        type: 'extract-text',
        variableName: 'total',
      }),
      expect.objectContaining({
        filename: 'tampr-blueprint.json',
        id: 'download-total',
        type: 'download-json',
      }),
    ]);
  });

  it('compiles automation nodes to readable JavaScript', () => {
    const recipe = automationRecipe();
    const js = compileBlueprintJavaScript(recipe);

    expect(compileBlueprintCss(recipe)).toBe('');
    expect(js).toContain("const PREFIX = '[Tampr Blueprint]';");
    expect(js).toContain('"type": "wait-for-element"');
    expect(js).toContain('"type": "click"');
    expect(js).toContain('"value": "oliver@example.com"');
    expect(js).toContain('"variableName": "headline"');
    expect(js).toContain('"filename": "tampr-flow.json"');
    expect(js).toContain('assertSafeClickTarget(element, step);');
    expect(js).toContain('globalThis.Tampr.download');
  });

  it('compiles custom code nodes into visible JavaScript steps', () => {
    const recipe = BlueprintRecipeSchema.parse({
      version: BLUEPRINT_RECIPE_VERSION,
      name: 'Custom flow',
      graph: {
        nodes: [
          {
            ...node('custom-step', 'custom-code', 'main'),
            code: 'values.custom = element.textContent;',
          },
        ],
        edges: [],
        layout: {
          'custom-step': { x: 0, y: 0 },
        },
      },
    });
    const js = compileBlueprintJavaScript(recipe);

    expect(js).toContain('"type": "custom-code"');
    expect(js).toContain('await runCustomCode(step, element);');
    expect(js).toContain('values.custom = element.textContent;');
  });

  it('updates custom code nodes and regenerates JavaScript', () => {
    const recipe = BlueprintRecipeSchema.parse({
      version: BLUEPRINT_RECIPE_VERSION,
      name: 'Custom flow',
      graph: {
        nodes: [node('custom-step', 'custom-code', 'main')],
        edges: [],
        layout: {
          'custom-step': { x: 0, y: 0 },
        },
      },
    });
    const updated = updateBlueprintNode(recipe, 'custom-step', {
      code: 'values.ready = true;',
    });

    expect(compileBlueprintJavaScript(updated)).toContain(
      'values.ready = true;',
    );
  });

  it('skips disabled automation nodes when compiling JavaScript', () => {
    const recipe = updateBlueprintNode(automationRecipe(), 'click-login', {
      enabled: false,
    });
    const js = compileBlueprintJavaScript(recipe);

    expect(js).toContain('"type": "wait-for-element"');
    expect(js).not.toContain('"id": "click-login"');
  });

  it('detects when generated JavaScript still matches the recipe', () => {
    const recipe = automationRecipe();

    expect(
      isBlueprintJavaScriptInSync(recipe, compileBlueprintJavaScript(recipe)),
    ).toBe(true);
    expect(isBlueprintJavaScriptInSync(recipe, 'console.log("edited");')).toBe(
      false,
    );
  });

  it('rejects unsafe automation variable names', () => {
    const result = BlueprintRecipeSchema.safeParse({
      version: BLUEPRINT_RECIPE_VERSION,
      name: 'Broken automation flow',
      graph: {
        nodes: [
          {
            ...node('extract-total', 'extract-text', '.total'),
            variableName: 'deal-total',
          },
        ],
        edges: [],
        layout: {
          'extract-total': { x: 0, y: 0 },
        },
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects branching graphs for now', () => {
    const result = BlueprintRecipeSchema.safeParse({
      ...twoNodeRecipe(),
      graph: {
        nodes: [
          node('hide-selection', 'hide', 'aside.subscribe'),
          node('highlight-selection', 'highlight', 'button.primary'),
          node('second-highlight', 'highlight', 'a.more'),
        ],
        edges: [
          edge('edge-1', 'hide-selection', 'highlight-selection'),
          edge('edge-2', 'hide-selection', 'second-highlight'),
        ],
        layout: {
          'hide-selection': { x: 0, y: 0 },
          'highlight-selection': { x: 200, y: 0 },
          'second-highlight': { x: 200, y: 140 },
        },
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      'Node hide-selection has more than one outgoing edge.',
    );
  });

  it('rejects graphs with disconnected nodes', () => {
    const result = BlueprintRecipeSchema.safeParse({
      version: BLUEPRINT_RECIPE_VERSION,
      name: 'Broken graph',
      graph: {
        nodes: [
          node('hide-selection', 'hide', 'aside.subscribe'),
          node('highlight-selection', 'highlight', 'button.primary'),
        ],
        edges: [],
        layout: {
          'hide-selection': { x: 0, y: 0 },
          'highlight-selection': { x: 200, y: 0 },
        },
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      'Blueprint graphs need exactly one start node.',
    );
  });
});

type TwoNodeRecipeInput = {
  firstEnabled?: boolean;
};

function twoNodeRecipe({
  firstEnabled = true,
}: TwoNodeRecipeInput = {}): BlueprintRecipe {
  return BlueprintRecipeSchema.parse({
    version: BLUEPRINT_RECIPE_VERSION,
    name: 'Cleanup flow',
    graph: {
      nodes: [
        {
          ...node('hide-selection', 'hide', 'aside.subscribe'),
          enabled: firstEnabled,
        },
        node('highlight-selection', 'highlight', 'main > button.primary'),
      ],
      edges: [edge('edge-1', 'hide-selection', 'highlight-selection')],
      layout: {
        'hide-selection': { x: 0, y: 0 },
        'highlight-selection': { x: 220, y: 0 },
      },
    },
  });
}

function automationRecipe(): BlueprintRecipe {
  return BlueprintRecipeSchema.parse({
    version: BLUEPRINT_RECIPE_VERSION,
    name: 'Login flow',
    graph: {
      nodes: [
        node('wait-email', 'wait-for-element', 'input[name="email"]'),
        {
          ...node('set-email', 'set-value', 'input[name="email"]'),
          value: 'oliver@example.com',
        },
        node('click-login', 'click', 'button.sign-in'),
        {
          ...node('extract-headline', 'extract-text', 'h1'),
          variableName: 'headline',
        },
        {
          ...node('download-headline', 'download-json', 'body'),
          filename: 'tampr-flow.json',
        },
      ],
      edges: [
        edge('edge-set-email', 'wait-email', 'set-email'),
        edge('edge-click-login', 'set-email', 'click-login'),
        edge('edge-extract-headline', 'click-login', 'extract-headline'),
        edge('edge-download-headline', 'extract-headline', 'download-headline'),
      ],
      layout: {
        'wait-email': { x: 0, y: 0 },
        'set-email': { x: 220, y: 0 },
        'click-login': { x: 440, y: 0 },
        'extract-headline': { x: 660, y: 0 },
        'download-headline': { x: 880, y: 0 },
      },
    },
  });
}

function node(id: string, type: BlueprintNodeType, selector: string) {
  return {
    id,
    enabled: true,
    selector,
    selectorMeta: selectorMeta(),
    type,
  };
}

function edge(id: string, fromNodeId: string, toNodeId: string) {
  return {
    id,
    fromNodeId,
    fromPort: 'success' as const,
    toNodeId,
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
