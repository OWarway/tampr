import { describe, expect, it } from 'vitest';

import {
  compileBlueprintCss,
  isBlueprintCssInSync,
} from '../../src/domain/blueprints/compiler';
import {
  BLUEPRINT_RECIPE_VERSION,
  BlueprintRecipeSchema,
  buildCssBlueprintRecipe,
  getLinearBlueprintNodes,
  insertBlueprintNode,
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
  ] satisfies Array<[BlueprintNodeType, string]>)(
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
      type: 'print-cleanup',
    });

    expect(recipe.graph.nodes[0]).toMatchObject({
      enabled: false,
      label: 'Hide signup panel',
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
