// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runTamprBlueprintPicker } from '../../src/blueprint/blueprint-picker-script';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('runTamprBlueprintPicker', () => {
  it('returns a selected element and action', async () => {
    document.body.innerHTML = `
      <main>
        <aside class="subscribe panel">Join the list</aside>
      </main>
    `;
    const target = document.querySelector('aside') as HTMLElement;

    stubElementFromPoint(target);
    stubRect(target);

    const resultPromise = runTamprBlueprintPicker();

    document.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: 24,
        clientY: 32,
      }),
    );
    document.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 24,
        clientY: 32,
      }),
    );

    const hideButton = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === 'Hide',
    );

    hideButton?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    await expect(resultPromise).resolves.toEqual({
      ok: true,
      action: 'hide',
      pick: {
        label: 'Join the list',
        selector: 'aside.subscribe.panel',
        tagName: 'aside',
        text: 'Join the list',
      },
    });
    expect(document.querySelector('[data-tampr-blueprint-picker]')).toBeNull();
  });

  it('cancels with Escape', async () => {
    const resultPromise = runTamprBlueprintPicker();

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Escape',
      }),
    );

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      reason: 'cancelled',
      message: 'Blueprint picking was cancelled.',
    });
  });
});

function stubElementFromPoint(element: Element): void {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: vi.fn(() => element),
  });
}

function stubRect(element: HTMLElement): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    bottom: 72,
    height: 40,
    left: 20,
    right: 180,
    top: 32,
    width: 160,
    x: 20,
    y: 32,
    toJSON: () => ({}),
  });
}
