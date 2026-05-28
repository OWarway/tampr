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
  updateBlueprintNode,
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
    });

    expect(recipe.graph.nodes[0]).toMatchObject({
      enabled: false,
      label: 'Hide signup panel',
    });
    expect(compileBlueprintCss(recipe)).toBe(`main > button.primary {
  outline: 3px solid #d44d3a !important;
  outline-offset: 3px !important;
}`);
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

function node(id: string, type: 'hide' | 'highlight', selector: string) {
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
