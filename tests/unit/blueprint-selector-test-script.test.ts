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
    ).toEqual({
      ok: true,
      result: {
        firstTagName: 'button',
        matchCount: 2,
        visibleCount: 1,
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
