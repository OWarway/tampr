// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  BLUEPRINT_RECIPE_VERSION,
  BlueprintRecipeSchema,
  buildCssBlueprintRecipe,
  type BlueprintRecipe,
} from '../../../domain/blueprints/recipe';
import { BlueprintPreview } from './BlueprintPreview';

afterEach(cleanup);

describe('BlueprintPreview', () => {
  it('renders nothing without blueprint metadata', () => {
    const { container } = render(<BlueprintPreview blueprint={undefined} />);

    expect(container.textContent).toBe('');
  });

  it('summarizes a saved blueprint node and selector quality', () => {
    render(
      <BlueprintPreview
        blueprint={buildCssBlueprintRecipe({
          id: 'hide-offer',
          label: 'Hide offer',
          selector: '[data-testid="offer"]',
          selectorMeta: selectorMeta('attribute'),
          type: 'hide',
        })}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Blueprint preview' }),
    ).toBeTruthy();
    expect(screen.getAllByText('Hide offer')).toHaveLength(2);
    expect(screen.getByText('[data-testid="offer"]')).toBeTruthy();
    expect(screen.getByText('Strong')).toBeTruthy();
    expect(screen.getByText('1 node')).toBeTruthy();
  });

  it('renders graph nodes in flow order', () => {
    render(<BlueprintPreview blueprint={twoNodeRecipe()} />);

    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining('Hide signup'),
      expect.stringContaining('Highlight checkout'),
    ]);
  });

  it('flags fragile selectors from saved metadata', () => {
    render(
      <BlueprintPreview
        blueprint={buildCssBlueprintRecipe({
          id: 'click-primary',
          label: 'Highlight primary button',
          selector: 'main > section:nth-of-type(2) button',
          selectorMeta: {
            matchCount: 1,
            segmentCount: 4,
            strategy: 'position',
            usesNthOfType: true,
          },
          type: 'highlight',
        })}
      />,
    );

    expect(screen.getByText('Fragile')).toBeTruthy();
    expect(screen.getByText(/layout changes may break it/)).toBeTruthy();
  });
});

function twoNodeRecipe(): BlueprintRecipe {
  return BlueprintRecipeSchema.parse({
    version: BLUEPRINT_RECIPE_VERSION,
    name: 'Deal checker',
    graph: {
      nodes: [
        {
          id: 'hide-signup',
          enabled: true,
          label: 'Hide signup',
          selector: '#signup',
          selectorMeta: selectorMeta('id'),
          type: 'hide',
        },
        {
          id: 'highlight-checkout',
          enabled: true,
          label: 'Highlight checkout',
          selector: '.checkout',
          selectorMeta: selectorMeta('class'),
          type: 'highlight',
        },
      ],
      edges: [
        {
          id: 'continue',
          fromNodeId: 'hide-signup',
          fromPort: 'success',
          toNodeId: 'highlight-checkout',
        },
      ],
      layout: {
        'hide-signup': { x: 0, y: 0 },
        'highlight-checkout': { x: 220, y: 0 },
      },
    },
  });
}

function selectorMeta(strategy: 'attribute' | 'class' | 'id') {
  return {
    matchCount: 1,
    segmentCount: 1,
    strategy,
    usesNthOfType: false,
  };
}
