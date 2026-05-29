// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runTamprBlueprintSelectorTest } from '../../src/blueprint/blueprint-selector-test-script';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('runTamprBlueprintSelectorTest', () => {
  it('counts matching and visible elements for a selector', () => {
    document.body.innerHTML = `
      <main>
        <button data-testid="buy">Buy now</button>
        <button data-testid="buy" style="display: none">Hidden buy</button>
      </main>
    `;

    for (const button of document.querySelectorAll('button')) {
      stubRect(button);
    }

    expect(
      runTamprBlueprintSelectorTest({
        selector: 'button[data-testid="buy"]',
      }),
    ).toMatchObject({
      ok: true,
      result: {
        firstTagName: 'button',
        matchCount: 2,
        visibleCount: 1,
      },
    });
  });

  it('suggests unique selector repairs when a selector matches too broadly', () => {
    document.body.innerHTML = `
      <main>
        <button data-testid="buy-primary">Buy now</button>
        <button data-testid="buy-secondary">Buy later</button>
      </main>
    `;

    for (const button of document.querySelectorAll('button')) {
      stubRect(button);
    }

    expect(runTamprBlueprintSelectorTest({ selector: 'button' })).toEqual({
      ok: true,
      result: {
        firstTagName: 'button',
        matchCount: 2,
        recommendation:
          'Selector matches multiple elements. Use a unique repair suggestion or pick the exact element again.',
        suggestions: [
          {
            matchCount: 1,
            reason: 'Unique data-testid marker on the matched element.',
            selector: 'button[data-testid="buy-primary"]',
            selectorMeta: {
              matchCount: 1,
              segmentCount: 1,
              strategy: 'attribute',
              usesNthOfType: false,
            },
            visibleCount: 1,
          },
          {
            matchCount: 1,
            reason: 'Unique data-testid marker on the matched element.',
            selector: 'button[data-testid="buy-secondary"]',
            selectorMeta: {
              matchCount: 1,
              segmentCount: 1,
              strategy: 'attribute',
              usesNthOfType: false,
            },
            visibleCount: 1,
          },
        ],
        visibleCount: 2,
      },
    });
  });

  it('returns zero counts for selectors that no longer match', () => {
    document.body.innerHTML = '<main><button>Buy now</button></main>';

    expect(
      runTamprBlueprintSelectorTest({ selector: '[data-testid="missing"]' }),
    ).toEqual({
      ok: true,
      result: {
        matchCount: 0,
        recommendation:
          'Selector does not match this page anymore. Pick the element again from the source page.',
        visibleCount: 0,
      },
    });
  });

  it('returns a user-facing error for invalid CSS selectors', () => {
    expect(runTamprBlueprintSelectorTest({ selector: 'button[' })).toEqual({
      ok: false,
      reason: 'invalid-selector',
      message: 'Blueprint selector is not valid CSS.',
    });
  });
});

function stubRect(element: Element): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    bottom: 50,
    height: 30,
    left: 10,
    right: 130,
    top: 20,
    width: 120,
    x: 10,
    y: 20,
    toJSON: () => ({}),
  });
}
