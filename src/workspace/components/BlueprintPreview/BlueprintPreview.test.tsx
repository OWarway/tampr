// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  compileBlueprintJavaScript,
  compileBlueprintCss,
} from '../../../domain/blueprints/compiler';
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

  it('edits saved node labels without changing generated CSS', () => {
    const onChange = vi.fn();
    const blueprint = buildCssBlueprintRecipe({
      id: 'hide-offer',
      label: 'Hide offer',
      selector: '[data-testid="offer"]',
      selectorMeta: selectorMeta('attribute'),
      type: 'hide',
    });
    const css = compileBlueprintCss(blueprint);

    render(
      <BlueprintPreview blueprint={blueprint} css={css} onChange={onChange} />,
    );

    fireEvent.change(screen.getByLabelText('Blueprint node label'), {
      target: { value: 'Hide spring offer' },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        graph: expect.objectContaining({
          nodes: [
            expect.objectContaining({
              label: 'Hide spring offer',
            }),
          ],
        }),
      }),
      css,
    );
  });

  it('regenerates CSS when toggling a synced node', () => {
    const onChange = vi.fn();
    const blueprint = twoNodeRecipe();

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('Enable blueprint node'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        graph: expect.objectContaining({
          nodes: [
            expect.objectContaining({
              enabled: false,
            }),
            expect.objectContaining({
              enabled: true,
            }),
          ],
        }),
      }),
      `.checkout {
  outline: 3px solid #d44d3a !important;
  outline-offset: 3px !important;
}`,
    );
  });

  it('regenerates CSS when changing a synced node action', () => {
    const onChange = vi.fn();
    const blueprint = buildCssBlueprintRecipe({
      id: 'hide-offer',
      label: 'Hide offer',
      selector: '[data-testid="offer"]',
      selectorMeta: selectorMeta('attribute'),
      type: 'hide',
    });

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Blueprint node action'), {
      target: { value: 'print-cleanup' },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        graph: expect.objectContaining({
          nodes: [
            expect.objectContaining({
              type: 'print-cleanup',
            }),
          ],
        }),
      }),
      `@media print {
  [data-testid="offer"] {
    display: none !important;
  }
}`,
    );
  });

  it('adds CSS action nodes from the library after the selected node', () => {
    const onChange = vi.fn();
    const blueprint = buildCssBlueprintRecipe({
      id: 'hide-offer',
      label: 'Hide offer',
      selector: '[data-testid="offer"]',
      selectorMeta: selectorMeta('attribute'),
      type: 'hide',
    });

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Add Print cleanup node' }),
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        graph: expect.objectContaining({
          nodes: [
            expect.objectContaining({
              id: 'hide-offer',
              type: 'hide',
            }),
            expect.objectContaining({
              id: 'print-cleanup-selection',
              type: 'print-cleanup',
            }),
          ],
        }),
      }),
      `[data-testid="offer"] {
  display: none !important;
}

@media print {
  [data-testid="offer"] {
    display: none !important;
  }
}`,
    );
  });

  it('adds automation nodes and regenerates JavaScript', () => {
    const onChange = vi.fn();
    const blueprint = buildCssBlueprintRecipe({
      id: 'hide-offer',
      label: 'Hide offer',
      selector: '[data-testid="offer"]',
      selectorMeta: selectorMeta('attribute'),
      type: 'hide',
    });
    const css = compileBlueprintCss(blueprint);

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={css}
        js=""
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Click node' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        graph: expect.objectContaining({
          nodes: [
            expect.objectContaining({
              id: 'hide-offer',
              type: 'hide',
            }),
            expect.objectContaining({
              id: 'click-selection',
              requireVisible: true,
              timeoutMs: 5000,
              type: 'click',
            }),
          ],
        }),
      }),
      css,
      expect.stringContaining('"type": "click"'),
    );
  });

  it('moves selected nodes and regenerates CSS in flow order', () => {
    const onChange = vi.fn();
    const blueprint = twoNodeRecipe();

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Highlight checkout/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Move up' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        graph: expect.objectContaining({
          nodes: [
            expect.objectContaining({
              id: 'highlight-checkout',
            }),
            expect.objectContaining({
              id: 'hide-signup',
            }),
          ],
        }),
      }),
      `.checkout {
  outline: 3px solid #d44d3a !important;
  outline-offset: 3px !important;
}

#signup {
  display: none !important;
}`,
    );
  });

  it('updates a node selector from the page picker and regenerates CSS', async () => {
    const onChange = vi.fn();
    const onPickSelector = vi.fn().mockResolvedValue({
      label: 'Dismiss',
      selector: '[data-testid="dismiss"]',
      selectorMeta: selectorMeta('attribute'),
      tagName: 'button',
    });
    const blueprint = buildCssBlueprintRecipe({
      id: 'hide-offer',
      label: 'Hide offer',
      selector: '[data-testid="offer"]',
      selectorMeta: selectorMeta('attribute'),
      type: 'hide',
    });

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        onPickSelector={onPickSelector}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pick again' }));

    await waitFor(() => expect(onPickSelector).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: [
              expect.objectContaining({
                selector: '[data-testid="dismiss"]',
                selectorMeta: selectorMeta('attribute'),
              }),
            ],
          }),
        }),
        `[data-testid="dismiss"] {
  display: none !important;
}`,
      ),
    );
  });

  it('tests the selected node selector against the source page', async () => {
    const onTestSelector = vi.fn().mockResolvedValue({
      firstTagName: 'button',
      matchCount: 1,
      visibleCount: 1,
    });
    const blueprint = buildCssBlueprintRecipe({
      id: 'hide-offer',
      label: 'Hide offer',
      selector: '[data-testid="offer"]',
      selectorMeta: selectorMeta('attribute'),
      type: 'hide',
    });

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        onTestSelector={onTestSelector}
        onChange={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Test selector' }));

    await waitFor(() =>
      expect(onTestSelector).toHaveBeenCalledWith('[data-testid="offer"]'),
    );
    expect(await screen.findByText('button: 1 match, 1 visible')).toBeTruthy();
  });

  it('removes the selected node and regenerates CSS', () => {
    const onChange = vi.fn();
    const blueprint = twoNodeRecipe();

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Highlight checkout/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove node' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        graph: expect.objectContaining({
          nodes: [
            expect.objectContaining({
              id: 'hide-signup',
            }),
          ],
        }),
      }),
      `#signup {
  display: none !important;
}`,
    );
  });

  it('locks code-changing controls when CSS has been edited by hand', () => {
    render(
      <BlueprintPreview
        blueprint={twoNodeRecipe()}
        css="main { color: red; }"
        onPickSelector={() => Promise.resolve(undefined)}
        onChange={() => undefined}
      />,
    );

    const enabledToggle = screen.getByLabelText(
      'Enable blueprint node',
    ) as HTMLInputElement;

    expect(screen.getByText('Code edited')).toBeTruthy();
    expect(enabledToggle.disabled).toBe(true);
    expect(
      (screen.getByLabelText('Blueprint node action') as HTMLSelectElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: 'Add Hide node',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Pick again' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Move down' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('locks code-changing controls when generated JavaScript has been edited by hand', () => {
    render(
      <BlueprintPreview
        blueprint={automationRecipe()}
        css=""
        js="console.log('edited');"
        onChange={() => undefined}
      />,
    );

    expect(screen.getByText('Code edited')).toBeTruthy();
    expect(
      (screen.getByLabelText('Enable blueprint node') as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: 'Add Click node',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('shows the selected action description in the inspector', () => {
    const blueprint = buildCssBlueprintRecipe({
      id: 'widen-selection',
      label: 'Widen article',
      selector: 'article.story',
      selectorMeta: selectorMeta('class'),
      type: 'widen',
    });

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        onChange={() => undefined}
      />,
    );

    expect(screen.getAllByText('Widen').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Relaxes narrow content containers for easier reading.'),
    ).toBeTruthy();
  });

  it('renders automation nodes with focused settings', () => {
    const blueprint = automationRecipe();

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        js={compileBlueprintJavaScript(blueprint)}
        onChange={() => undefined}
      />,
    );

    expect(screen.getAllByText('Wait for element').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Pauses the flow until the selected element appears.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Require visible element')).toBeTruthy();
    expect(screen.getByLabelText('Automation timeout')).toBeTruthy();
    expect(screen.getByLabelText('Automation safety')).toBeTruthy();
    expect(screen.getByText('Normal')).toBeTruthy();
    expect(screen.getByText('No automation warnings.')).toBeTruthy();
    expect(screen.queryByLabelText('Blueprint node action')).toBeNull();
  });

  it('surfaces automation safety warnings in the inspector', () => {
    const blueprint = riskyClickRecipe();

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        js={compileBlueprintJavaScript(blueprint)}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByText('Review')).toBeTruthy();
    expect(
      screen.getByText(
        'This click looks like it may submit, buy, send, or delete.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('Click steps should require a visible target.'),
    ).toBeTruthy();
  });

  it('tests automation nodes against the source page without running them', async () => {
    const onTestAutomationNode = vi.fn().mockResolvedValue({
      action: 'wait-for-element',
      firstTagName: 'section',
      issues: [],
      matchCount: 1,
      preview: 'Deal',
      ready: true,
      visibleCount: 1,
    });
    const blueprint = automationRecipe();

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        js={compileBlueprintJavaScript(blueprint)}
        onTestAutomationNode={onTestAutomationNode}
        onChange={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Test node' }));

    await waitFor(() =>
      expect(onTestAutomationNode).toHaveBeenCalledWith({
        selector: '[data-testid="deal"]',
        type: 'wait-for-element',
        requireVisible: true,
      }),
    );
    expect(await screen.findByText('Ready on page')).toBeTruthy();
    expect(screen.getByText('1 match, 1 visible')).toBeTruthy();
    expect(screen.getByText('Deal')).toBeTruthy();
  });

  it('edits automation values and regenerates JavaScript', () => {
    const onChange = vi.fn();
    const blueprint = setValueRecipe();

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        js={compileBlueprintJavaScript(blueprint)}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Automation value'), {
      target: { value: 'oliver@example.com' },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        graph: expect.objectContaining({
          nodes: [
            expect.objectContaining({
              type: 'set-value',
              value: 'oliver@example.com',
            }),
          ],
        }),
      }),
      '',
      expect.stringContaining('"value": "oliver@example.com"'),
    );
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

function automationRecipe(): BlueprintRecipe {
  return BlueprintRecipeSchema.parse({
    version: BLUEPRINT_RECIPE_VERSION,
    name: 'Wait for deal',
    graph: {
      nodes: [
        {
          id: 'wait-for-deal',
          enabled: true,
          selector: '[data-testid="deal"]',
          selectorMeta: selectorMeta('attribute'),
          type: 'wait-for-element',
        },
      ],
      edges: [],
      layout: {
        'wait-for-deal': { x: 0, y: 0 },
      },
    },
  });
}

function riskyClickRecipe(): BlueprintRecipe {
  return BlueprintRecipeSchema.parse({
    version: BLUEPRINT_RECIPE_VERSION,
    name: 'Risky click',
    graph: {
      nodes: [
        {
          id: 'submit-order',
          enabled: true,
          label: 'Submit order',
          requireVisible: false,
          selector: 'button.checkout',
          selectorMeta: selectorMeta('attribute'),
          timeoutMs: 5000,
          type: 'click',
        },
      ],
      edges: [],
      layout: {
        'submit-order': { x: 0, y: 0 },
      },
    },
  });
}

function setValueRecipe(): BlueprintRecipe {
  return BlueprintRecipeSchema.parse({
    version: BLUEPRINT_RECIPE_VERSION,
    name: 'Set email',
    graph: {
      nodes: [
        {
          id: 'set-email',
          enabled: true,
          selector: 'input[name="email"]',
          selectorMeta: selectorMeta('attribute'),
          type: 'set-value',
          value: '',
        },
      ],
      edges: [],
      layout: {
        'set-email': { x: 0, y: 0 },
      },
    },
  });
}
