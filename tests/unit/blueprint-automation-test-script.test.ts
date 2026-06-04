// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runTamprBlueprintAutomationNodeTest } from '../../src/blueprint/blueprint-automation-test-script';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('runTamprBlueprintAutomationNodeTest', () => {
  it('reports a ready visible wait target without mutating the page', () => {
    document.body.innerHTML =
      '<main><button data-testid="deal">Deal</button></main>';
    const button = document.querySelector('button') as HTMLButtonElement;
    const click = vi.fn();

    button.addEventListener('click', click);
    stubRect(button);

    expect(
      runTamprBlueprintAutomationNodeTest({
        type: 'click',
        selector: 'button[data-testid="deal"]',
        requireVisible: true,
      }),
    ).toEqual({
      ok: true,
      result: {
        action: 'click',
        firstTagName: 'button',
        issues: [],
        matchCount: 1,
        preview: 'Deal',
        ready: true,
        visibleCount: 1,
      },
    });
    expect(click).not.toHaveBeenCalled();
  });

  it('reports review issues for risky click targets', () => {
    document.body.innerHTML = '<button class="buy">Buy now</button>';
    stubRect(document.querySelector('button') as HTMLButtonElement);

    expect(
      runTamprBlueprintAutomationNodeTest({
        type: 'click',
        selector: 'button.buy',
        requireVisible: true,
      }),
    ).toEqual({
      ok: true,
      result: {
        action: 'click',
        firstTagName: 'button',
        issues: ['Click target looks risky and needs manual review.'],
        matchCount: 1,
        preview: 'Buy now',
        ready: false,
        visibleCount: 1,
      },
    });
  });

  it('checks fields without writing values', () => {
    document.body.innerHTML =
      '<input name="email" placeholder="Email" value="original">';
    const input = document.querySelector('input') as HTMLInputElement;
    stubRect(input);

    expect(
      runTamprBlueprintAutomationNodeTest({
        type: 'set-value',
        selector: 'input[name="email"]',
        requireVisible: true,
        value: 'new@example.com',
      }),
    ).toEqual({
      ok: true,
      result: {
        action: 'set-value',
        firstTagName: 'input',
        issues: [],
        matchCount: 1,
        preview: 'text input',
        ready: true,
        visibleCount: 1,
      },
    });
    expect(input.value).toBe('original');
  });

  it('validates download node configuration without downloading', () => {
    expect(
      runTamprBlueprintAutomationNodeTest({
        type: 'download-json',
        selector: 'body',
        filename: 'report.txt',
      }),
    ).toEqual({
      ok: true,
      result: {
        action: 'download-json',
        issues: ['Download filename should end with .json.'],
        matchCount: 0,
        preview: 'Downloads all collected values.',
        ready: false,
        visibleCount: 0,
      },
    });
  });

  it('previews repeated list extraction without mutating the page', () => {
    document.body.innerHTML = `
      <article class="deal">First deal</article>
      <article class="deal">Second deal</article>
      <article class="deal">Third deal</article>
    `;
    document.querySelectorAll('.deal').forEach((element) => stubRect(element));

    expect(
      runTamprBlueprintAutomationNodeTest({
        type: 'extract-list',
        selector: '.deal',
        maxItems: 2,
        requireVisible: true,
        variableName: 'deals',
      }),
    ).toEqual({
      ok: true,
      result: {
        action: 'extract-list',
        firstTagName: 'article',
        issues: [
          'Selector matches 3 elements; only the first 2 will be extracted.',
        ],
        matchCount: 3,
        preview: 'First rows: "First deal", "Second deal"',
        ready: false,
        visibleCount: 3,
      },
    });
  });

  it('returns an invalid selector error', () => {
    expect(
      runTamprBlueprintAutomationNodeTest({
        type: 'wait-for-element',
        selector: 'button[',
        requireVisible: true,
      }),
    ).toEqual({
      ok: false,
      reason: 'invalid-selector',
      message: 'Automation node selector is not valid CSS.',
    });
  });
});

function stubRect(element: Element): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    bottom: 48,
    height: 28,
    left: 10,
    right: 110,
    top: 20,
    width: 100,
    x: 10,
    y: 20,
    toJSON: () => ({}),
  });
}
