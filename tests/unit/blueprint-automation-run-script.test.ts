// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runTamprBlueprintAutomationNode } from '../../src/blueprint/blueprint-automation-run-script';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('runTamprBlueprintAutomationNode', () => {
  it('runs a wait node against a visible element without clicking it', async () => {
    document.body.innerHTML =
      '<main><button data-testid="deal">Open deal</button></main>';
    const button = document.querySelector('button') as HTMLButtonElement;
    const click = vi.fn();

    button.addEventListener('click', click);
    stubRect(button);

    await expect(
      runTamprBlueprintAutomationNode({
        type: 'wait-for-element',
        selector: 'button[data-testid="deal"]',
        requireVisible: true,
        timeoutMs: 5000,
      }),
    ).resolves.toEqual({
      ok: true,
      result: {
        action: 'wait-for-element',
        durationMs: expect.any(Number),
        firstTagName: 'button',
        matchCount: 1,
        message: 'Element is ready on the source page.',
        preview: 'Open deal',
        visibleCount: 1,
      },
    });
    expect(click).not.toHaveBeenCalled();
  });

  it('extracts readable text from a source page element', async () => {
    document.body.innerHTML =
      '<section data-testid="deal">  Save   25% today </section>';
    stubRect(document.querySelector('section') as HTMLElement);

    await expect(
      runTamprBlueprintAutomationNode({
        type: 'extract-text',
        selector: '[data-testid="deal"]',
        requireVisible: true,
        timeoutMs: 5000,
        variableName: 'dealText',
      }),
    ).resolves.toEqual({
      ok: true,
      result: {
        action: 'extract-text',
        durationMs: expect.any(Number),
        firstTagName: 'section',
        matchCount: 1,
        message: 'Text extracted from the source page.',
        preview: 'Save 25% today',
        value: 'Save 25% today',
        variableName: 'dealText',
        visibleCount: 1,
      },
    });
  });

  it('refuses unsupported mutating node types in the manual runner', async () => {
    document.body.innerHTML = '<button>Buy now</button>';
    const button = document.querySelector('button') as HTMLButtonElement;
    const click = vi.fn();

    button.addEventListener('click', click);
    stubRect(button);

    await expect(
      runTamprBlueprintAutomationNode({
        type: 'click',
        selector: 'button',
        requireVisible: true,
        timeoutMs: 5000,
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'unsupported',
      message:
        'Manual node runs currently support wait and extract-text steps.',
    });
    expect(click).not.toHaveBeenCalled();
  });

  it('returns an invalid selector error', async () => {
    await expect(
      runTamprBlueprintAutomationNode({
        type: 'wait-for-element',
        selector: 'button[',
        requireVisible: true,
        timeoutMs: 5000,
      }),
    ).resolves.toEqual({
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
