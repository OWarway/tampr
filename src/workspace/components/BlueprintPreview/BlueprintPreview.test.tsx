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
    expect(screen.getByText(/95% confidence/)).toBeTruthy();
    expect(screen.getByText('1 node')).toBeTruthy();
  });

  it('renders graph nodes in flow order', () => {
    render(<BlueprintPreview blueprint={twoNodeRecipe()} />);

    expect(
      screen.getByRole('group', { name: 'Blueprint flow diagram' }),
    ).toBeTruthy();
    expect(screen.getByText('Start')).toBeTruthy();
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

  it('tests the whole flow through safe source-page checks', async () => {
    const onTestSelector = vi.fn().mockResolvedValue({
      firstTagName: 'aside',
      matchCount: 1,
      visibleCount: 1,
    });
    const onTestAutomationNode = vi.fn().mockResolvedValue({
      action: 'wait-for-element',
      firstTagName: 'section',
      issues: [],
      matchCount: 1,
      preview: 'Deal',
      ready: true,
      visibleCount: 1,
    });
    const blueprint = flowPreviewRecipe();

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        js={compileBlueprintJavaScript(blueprint)}
        onTestSelector={onTestSelector}
        onTestAutomationNode={onTestAutomationNode}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Test flow' }));

    await waitFor(() =>
      expect(onTestSelector).toHaveBeenCalledWith('aside.signup'),
    );
    await waitFor(() =>
      expect(onTestAutomationNode).toHaveBeenCalledWith({
        selector: '[data-testid="deal"]',
        type: 'wait-for-element',
        requireVisible: true,
      }),
    );
    expect(await screen.findByText('2 ready, 0 need review')).toBeTruthy();
    expect(screen.getAllByText('Ready')).toHaveLength(2);
    expect(screen.getByText('Hide: aside: 1 match, 1 visible')).toBeTruthy();
    expect(
      screen.getByText('Wait for element: section: 1 match, 1 visible'),
    ).toBeTruthy();
    expect(screen.getByText('Deal')).toBeTruthy();
  });

  it('runs supported flow steps with explicit click confirmation', async () => {
    const onRunAutomationNode = vi
      .fn()
      .mockResolvedValueOnce({
        action: 'wait-for-element',
        durationMs: 8,
        firstTagName: 'section',
        matchCount: 1,
        message: 'Element is ready on the source page.',
        preview: 'Deal',
        visibleCount: 1,
      })
      .mockResolvedValueOnce({
        action: 'extract-text',
        durationMs: 10,
        firstTagName: 'h2',
        matchCount: 1,
        message: 'Text extracted from the source page.',
        value: 'Deal title',
        variableName: 'dealTitle',
        visibleCount: 1,
      })
      .mockResolvedValueOnce({
        action: 'click',
        durationMs: 12,
        firstTagName: 'button',
        matchCount: 1,
        message: 'Element clicked on the source page.',
        preview: 'Open deal',
        visibleCount: 1,
      });
    const blueprint = flowRunRecipe();

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        js={compileBlueprintJavaScript(blueprint)}
        onRunAutomationNode={onRunAutomationNode}
      />,
    );

    const runButton = screen.getByRole('button', { name: 'Run flow' });

    expect((runButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(
      screen.getByLabelText('Confirm flow click steps on source page'),
    );
    fireEvent.click(runButton);

    await waitFor(() => expect(onRunAutomationNode).toHaveBeenCalledTimes(3));
    expect(onRunAutomationNode).toHaveBeenNthCalledWith(1, {
      label: 'Wait for deal',
      selector: '[data-testid="deal"]',
      type: 'wait-for-element',
      requireVisible: true,
      timeoutMs: 5000,
    });
    expect(onRunAutomationNode).toHaveBeenNthCalledWith(2, {
      label: 'Extract title',
      selector: '[data-testid="deal-title"]',
      type: 'extract-text',
      requireVisible: true,
      timeoutMs: 5000,
      variableName: 'dealTitle',
    });
    expect(onRunAutomationNode).toHaveBeenNthCalledWith(3, {
      label: 'Open deal',
      selector: 'button[data-testid="open"]',
      type: 'click',
      confirmAction: true,
      requireVisible: true,
      timeoutMs: 5000,
    });
    expect(
      await screen.findByText('3 complete, 0 need review, 1 skipped'),
    ).toBeTruthy();
    expect(screen.getByText('Skipped CSS')).toBeTruthy();
    expect(screen.getByText('Deal title')).toBeTruthy();
    expect(screen.getAllByText('Complete')).toHaveLength(3);
    expect(screen.getAllByText('Skipped')).toHaveLength(1);
  });

  it('blocks unsupported flow run steps before touching the page', async () => {
    const onRunAutomationNode = vi.fn();
    const blueprint = setValueRecipe();

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        js={compileBlueprintJavaScript(blueprint)}
        onRunAutomationNode={onRunAutomationNode}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run flow' }));

    expect(await screen.findByText('0 complete, 1 need review')).toBeTruthy();
    expect(
      screen.getByText('Set value is not available in guarded flow runs yet.'),
    ).toBeTruthy();
    expect(screen.getAllByText('Blocked')).toHaveLength(2);
    expect(onRunAutomationNode).not.toHaveBeenCalled();
  });

  it('applies selector repair suggestions from the source page test', async () => {
    const onChange = vi.fn();
    const onTestSelector = vi.fn().mockResolvedValue({
      firstTagName: 'button',
      matchCount: 2,
      recommendation:
        'Selector matches multiple elements. Use a unique repair suggestion or pick the exact element again.',
      suggestions: [
        {
          matchCount: 1,
          reason: 'Unique data-testid marker on the matched element.',
          selector: 'button[data-testid="offer-primary"]',
          selectorMeta: selectorMeta('attribute'),
          visibleCount: 1,
        },
      ],
      visibleCount: 2,
    });
    const blueprint = buildCssBlueprintRecipe({
      id: 'hide-offer',
      label: 'Hide offer',
      selector: 'button',
      selectorMeta: {
        matchCount: 2,
        segmentCount: 1,
        strategy: 'path',
        usesNthOfType: false,
      },
      type: 'hide',
    });

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        onChange={onChange}
        onTestSelector={onTestSelector}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Test selector' }));

    expect(
      await screen.findByText('button[data-testid="offer-primary"]'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use selector' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        graph: expect.objectContaining({
          nodes: [
            expect.objectContaining({
              selector: 'button[data-testid="offer-primary"]',
              selectorMeta: selectorMeta('attribute'),
            }),
          ],
        }),
      }),
      `button[data-testid="offer-primary"] {
  display: none !important;
}`,
    );
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
      screen.getByText(
        'Blueprint clicks are synthetic: event.isTrusted === false.',
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

  it('runs supported automation nodes against the source page', async () => {
    const onRunAutomationNode = vi.fn().mockResolvedValue({
      action: 'wait-for-element',
      durationMs: 8,
      firstTagName: 'section',
      matchCount: 1,
      message: 'Element is ready on the source page.',
      preview: 'Deal',
      visibleCount: 1,
    });
    const blueprint = automationRecipe();

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        js={compileBlueprintJavaScript(blueprint)}
        onRunAutomationNode={onRunAutomationNode}
        onChange={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run node' }));

    await waitFor(() =>
      expect(onRunAutomationNode).toHaveBeenCalledWith({
        selector: '[data-testid="deal"]',
        type: 'wait-for-element',
        requireVisible: true,
        timeoutMs: 5000,
      }),
    );
    expect(await screen.findByText('Ran on page')).toBeTruthy();
    expect(screen.getByText('1 match, 1 visible')).toBeTruthy();
    expect(
      screen.getByText('Element is ready on the source page.'),
    ).toBeTruthy();
    expect(screen.getByText('Deal')).toBeTruthy();
  });

  it('requires explicit confirmation before running click nodes', async () => {
    const onRunAutomationNode = vi.fn().mockResolvedValue({
      action: 'click',
      durationMs: 8,
      firstTagName: 'button',
      matchCount: 1,
      message: 'Element clicked on the source page.',
      preview: 'Open panel',
      visibleCount: 1,
    });
    const blueprint = safeClickRecipe();

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        js={compileBlueprintJavaScript(blueprint)}
        onRunAutomationNode={onRunAutomationNode}
        onChange={() => undefined}
      />,
    );

    const runButton = screen.getByRole('button', { name: 'Run node' });

    expect((runButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Confirm click on source page'));
    fireEvent.click(runButton);

    await waitFor(() =>
      expect(onRunAutomationNode).toHaveBeenCalledWith({
        selector: 'button[data-testid="open"]',
        type: 'click',
        confirmAction: true,
        requireVisible: true,
        timeoutMs: 5000,
      }),
    );
    expect(await screen.findByText('Ran on page')).toBeTruthy();
    expect(
      screen.getByText('Element clicked on the source page.'),
    ).toBeTruthy();
    expect(
      screen.getAllByText(
        'Blueprint clicks are synthetic: event.isTrusted === false.',
      ),
    ).toHaveLength(2);
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

  it('edits custom code nodes and regenerates JavaScript', () => {
    const onChange = vi.fn();
    const blueprint = customCodeRecipe();

    render(
      <BlueprintPreview
        blueprint={blueprint}
        css={compileBlueprintCss(blueprint)}
        js={compileBlueprintJavaScript(blueprint)}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Automation custom code'), {
      target: { value: 'values.ready = true;' },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        graph: expect.objectContaining({
          nodes: [
            expect.objectContaining({
              code: 'values.ready = true;',
              type: 'custom-code',
            }),
          ],
        }),
      }),
      '',
      expect.stringContaining('values.ready = true;'),
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

function flowPreviewRecipe(): BlueprintRecipe {
  return BlueprintRecipeSchema.parse({
    version: BLUEPRINT_RECIPE_VERSION,
    name: 'Preview flow',
    graph: {
      nodes: [
        {
          id: 'hide-signup',
          enabled: true,
          label: 'Hide signup',
          selector: 'aside.signup',
          selectorMeta: selectorMeta('class'),
          type: 'hide',
        },
        {
          id: 'wait-for-deal',
          enabled: true,
          label: 'Wait for deal',
          requireVisible: true,
          selector: '[data-testid="deal"]',
          selectorMeta: selectorMeta('attribute'),
          type: 'wait-for-element',
        },
      ],
      edges: [
        {
          id: 'edge-wait-for-deal',
          fromNodeId: 'hide-signup',
          fromPort: 'success',
          toNodeId: 'wait-for-deal',
        },
      ],
      layout: {
        'hide-signup': { x: 0, y: 0 },
        'wait-for-deal': { x: 220, y: 0 },
      },
    },
  });
}

function flowRunRecipe(): BlueprintRecipe {
  return BlueprintRecipeSchema.parse({
    version: BLUEPRINT_RECIPE_VERSION,
    name: 'Run flow',
    graph: {
      nodes: [
        {
          id: 'hide-signup',
          enabled: true,
          label: 'Hide signup',
          selector: 'aside.signup',
          selectorMeta: selectorMeta('class'),
          type: 'hide',
        },
        {
          id: 'wait-for-deal',
          enabled: true,
          label: 'Wait for deal',
          requireVisible: true,
          selector: '[data-testid="deal"]',
          selectorMeta: selectorMeta('attribute'),
          timeoutMs: 5000,
          type: 'wait-for-element',
        },
        {
          id: 'extract-title',
          enabled: true,
          label: 'Extract title',
          requireVisible: true,
          selector: '[data-testid="deal-title"]',
          selectorMeta: selectorMeta('attribute'),
          timeoutMs: 5000,
          type: 'extract-text',
          variableName: 'dealTitle',
        },
        {
          id: 'open-deal',
          enabled: true,
          label: 'Open deal',
          requireVisible: true,
          selector: 'button[data-testid="open"]',
          selectorMeta: selectorMeta('attribute'),
          timeoutMs: 5000,
          type: 'click',
        },
      ],
      edges: [
        {
          id: 'edge-wait-for-deal',
          fromNodeId: 'hide-signup',
          fromPort: 'success',
          toNodeId: 'wait-for-deal',
        },
        {
          id: 'edge-extract-title',
          fromNodeId: 'wait-for-deal',
          fromPort: 'success',
          toNodeId: 'extract-title',
        },
        {
          id: 'edge-open-deal',
          fromNodeId: 'extract-title',
          fromPort: 'success',
          toNodeId: 'open-deal',
        },
      ],
      layout: {
        'hide-signup': { x: 0, y: 0 },
        'wait-for-deal': { x: 220, y: 0 },
        'extract-title': { x: 440, y: 0 },
        'open-deal': { x: 660, y: 0 },
      },
    },
  });
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

function safeClickRecipe(): BlueprintRecipe {
  return BlueprintRecipeSchema.parse({
    version: BLUEPRINT_RECIPE_VERSION,
    name: 'Open panel',
    graph: {
      nodes: [
        {
          id: 'open-panel',
          enabled: true,
          requireVisible: true,
          selector: 'button[data-testid="open"]',
          selectorMeta: selectorMeta('attribute'),
          timeoutMs: 5000,
          type: 'click',
        },
      ],
      edges: [],
      layout: {
        'open-panel': { x: 0, y: 0 },
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

function customCodeRecipe(): BlueprintRecipe {
  return BlueprintRecipeSchema.parse({
    version: BLUEPRINT_RECIPE_VERSION,
    name: 'Custom code',
    graph: {
      nodes: [
        {
          id: 'custom-code',
          code: '// ready',
          enabled: true,
          selector: 'main',
          selectorMeta: selectorMeta('attribute'),
          type: 'custom-code',
        },
      ],
      edges: [],
      layout: {
        'custom-code': { x: 0, y: 0 },
      },
    },
  });
}
