// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cancelTamprBlueprintAutomationRun,
  runTamprBlueprintAutomationNode,
} from '../../src/blueprint/blueprint-automation-run-script';

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

  it('extracts repeated mapped fields into a bounded JSON list', async () => {
    document.body.innerHTML = `
      <article class="deal"><h2>First deal</h2><a href="/first">Open</a></article>
      <article class="deal"><h2>Second deal</h2><a href="/second">Open</a></article>
      <article class="deal"><h2>Third deal</h2><a href="/third">Open</a></article>
    `;
    document.querySelectorAll('.deal').forEach((element) => stubRect(element));

    await expect(
      runTamprBlueprintAutomationNode({
        type: 'extract-list',
        selector: '.deal',
        fields: [
          {
            name: 'title',
            selector: 'h2',
            source: 'text',
          },
          {
            attribute: 'href',
            name: 'url',
            selector: 'a',
            source: 'attribute',
          },
        ],
        maxItems: 2,
        requireVisible: true,
        timeoutMs: 5000,
        variableName: 'deals',
      }),
    ).resolves.toEqual({
      ok: true,
      result: {
        action: 'extract-list',
        durationMs: expect.any(Number),
        firstTagName: 'article',
        matchCount: 3,
        message: 'Extracted 2 list items from the source page.',
        preview:
          'title: "First deal", url: "/first", title: "Second deal", url: "/second"',
        value: JSON.stringify(
          [
            { title: 'First deal', url: '/first' },
            { title: 'Second deal', url: '/second' },
          ],
          null,
          2,
        ),
        variableName: 'deals',
        visibleCount: 3,
      },
    });
  });

  it('extracts a mapped row field from the list item itself', async () => {
    document.body.innerHTML = `
      <article class="deal">First deal</article>
      <article class="deal">Second deal</article>
    `;
    document.querySelectorAll('.deal').forEach((element) => stubRect(element));

    await expect(
      runTamprBlueprintAutomationNode({
        type: 'extract-list',
        selector: '.deal',
        fields: [
          {
            name: 'rowText',
            selector: ':scope',
            source: 'text',
          },
        ],
        maxItems: 2,
        requireVisible: true,
        timeoutMs: 5000,
        variableName: 'deals',
      }),
    ).resolves.toMatchObject({
      ok: true,
      result: {
        value: JSON.stringify(
          [{ rowText: 'First deal' }, { rowText: 'Second deal' }],
          null,
          2,
        ),
      },
    });
  });

  it('runs a confirmed click node against a safe visible element', async () => {
    document.body.innerHTML = '<button data-testid="open">Open panel</button>';
    const button = document.querySelector('button') as HTMLButtonElement;
    const click = vi.fn();

    button.addEventListener('click', click);
    stubRect(button);

    await expect(
      runTamprBlueprintAutomationNode({
        type: 'click',
        selector: 'button[data-testid="open"]',
        confirmAction: true,
        requireVisible: true,
        timeoutMs: 5000,
      }),
    ).resolves.toEqual({
      ok: true,
      result: {
        action: 'click',
        durationMs: expect.any(Number),
        firstTagName: 'button',
        matchCount: 1,
        message: 'Element clicked on the source page.',
        preview: 'Open panel',
        visibleCount: 1,
      },
    });
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('resolves to the closest interactive ancestor when the picked element is a child', async () => {
    document.body.innerHTML =
      '<button data-testid="open"><span class="icon">+</span><span class="label">Open panel</span></button>';
    const button = document.querySelector('button') as HTMLButtonElement;
    const label = document.querySelector('.label') as HTMLSpanElement;
    const buttonClick = vi.fn();

    button.addEventListener('click', buttonClick);
    stubRect(button);
    stubRect(label);

    const response = await runTamprBlueprintAutomationNode({
      type: 'click',
      selector: 'span.label',
      confirmAction: true,
      requireVisible: true,
      timeoutMs: 5000,
    });

    expect(response.ok).toBe(true);
    expect(buttonClick).toHaveBeenCalledTimes(1);
  });

  it('dispatches pointer and mouse events alongside the click', async () => {
    document.body.innerHTML = '<button data-testid="open">Open panel</button>';
    const button = document.querySelector('button') as HTMLButtonElement;
    const observed: string[] = [];

    for (const type of [
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ]) {
      button.addEventListener(type, (event) => {
        observed.push(event.type);
      });
    }
    stubRect(button);

    await runTamprBlueprintAutomationNode({
      type: 'click',
      selector: 'button',
      confirmAction: true,
      requireVisible: true,
      timeoutMs: 5000,
    });

    expect(observed).toEqual([
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ]);
  });

  it('blocks the click when the resolved ancestor reads as risky even if the picked child does not', async () => {
    document.body.innerHTML =
      '<button><span class="label">Confirm</span> purchase</button>';
    const button = document.querySelector('button') as HTMLButtonElement;
    const label = document.querySelector('span.label') as HTMLSpanElement;
    const click = vi.fn();

    button.addEventListener('click', click);
    stubRect(button);
    stubRect(label);

    await expect(
      runTamprBlueprintAutomationNode({
        type: 'click',
        selector: 'span.label',
        confirmAction: true,
        requireVisible: true,
        timeoutMs: 5000,
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'unsafe-target',
      message: 'Manual click run refused a risky target.',
    });
    expect(click).not.toHaveBeenCalled();
  });

  it('refuses unconfirmed click nodes', async () => {
    document.body.innerHTML = '<button data-testid="open">Open panel</button>';
    const button = document.querySelector('button') as HTMLButtonElement;
    const click = vi.fn();

    button.addEventListener('click', click);
    stubRect(button);

    await expect(
      runTamprBlueprintAutomationNode({
        type: 'click',
        selector: 'button[data-testid="open"]',
        requireVisible: true,
        timeoutMs: 5000,
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'requires-confirmation',
      message: 'Manual click runs need explicit confirmation.',
    });
    expect(click).not.toHaveBeenCalled();
  });

  it('refuses risky confirmed click targets', async () => {
    document.body.innerHTML = '<button>Buy now</button>';
    const button = document.querySelector('button') as HTMLButtonElement;
    const click = vi.fn();

    button.addEventListener('click', click);
    stubRect(button);

    await expect(
      runTamprBlueprintAutomationNode({
        type: 'click',
        selector: 'button',
        confirmAction: true,
        requireVisible: true,
        timeoutMs: 5000,
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'unsafe-target',
      message: 'Manual click run refused a risky target.',
    });
    expect(click).not.toHaveBeenCalled();
  });

  it('sets a confirmed form field value and dispatches field events', async () => {
    document.body.innerHTML = '<input value="original">';
    const input = document.querySelector('input') as HTMLInputElement;
    const observed: string[] = [];

    input.addEventListener('input', (event) => observed.push(event.type));
    input.addEventListener('change', (event) => observed.push(event.type));
    stubRect(input);

    await expect(
      runTamprBlueprintAutomationNode({
        type: 'set-value',
        selector: 'input',
        confirmAction: true,
        requireVisible: true,
        timeoutMs: 5000,
        value: 'changed',
      }),
    ).resolves.toEqual({
      ok: true,
      result: {
        action: 'set-value',
        durationMs: expect.any(Number),
        firstTagName: 'input',
        matchCount: 1,
        message: 'Value set on the source page.',
        value: 'changed',
        visibleCount: 1,
      },
    });
    expect(input.value).toBe('changed');
    expect(observed).toEqual(['input', 'change']);
  });

  it('refuses unconfirmed set-value nodes', async () => {
    document.body.innerHTML = '<input value="original">';
    const input = document.querySelector('input') as HTMLInputElement;
    stubRect(input);

    await expect(
      runTamprBlueprintAutomationNode({
        type: 'set-value',
        selector: 'input',
        requireVisible: true,
        timeoutMs: 5000,
        value: 'changed',
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'requires-confirmation',
      message: 'Manual set-value runs need explicit confirmation.',
    });
    expect(input.value).toBe('original');
  });

  it('refuses protected set-value fields', async () => {
    document.body.innerHTML = '<input name="password" type="password">';
    const input = document.querySelector('input') as HTMLInputElement;
    stubRect(input);

    await expect(
      runTamprBlueprintAutomationNode({
        type: 'set-value',
        selector: 'input',
        confirmAction: true,
        requireVisible: true,
        timeoutMs: 5000,
        value: 'secret',
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'unsafe-target',
      message: 'Manual set-value run refused a protected field.',
    });
    expect(input.value).toBe('');
  });

  it('stops a running automation node before timeout', async () => {
    const resultPromise = runTamprBlueprintAutomationNode({
      type: 'wait-for-element',
      selector: '[data-testid="late"]',
      requireVisible: true,
      runId: 'run-test',
      timeoutMs: 1000,
    });

    window.setTimeout(() => {
      cancelTamprBlueprintAutomationRun({ runId: 'run-test' });
    }, 0);

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      reason: 'cancelled',
      message: 'Automation node run was stopped.',
    });
  });

  it('refuses unsupported mutating node types in the manual runner', async () => {
    await expect(
      runTamprBlueprintAutomationNode({
        type: 'download-json',
        selector: 'main',
        timeoutMs: 5000,
      }),
    ).resolves.toEqual({
      ok: false,
      reason: 'unsupported',
      message:
        'Manual node runs currently support wait, extract-text, extract-list, confirmed set-value, and confirmed click steps.',
    });
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

  it('does not disguise non-selector runtime errors as invalid selectors', async () => {
    document.body.innerHTML = '<button data-testid="open">Open panel</button>';
    const button = document.querySelector('button') as HTMLButtonElement;

    stubRect(button);
    vi.spyOn(button, 'dispatchEvent').mockImplementationOnce(() => {
      throw new Error('page listener exploded');
    });

    await expect(
      runTamprBlueprintAutomationNode({
        type: 'click',
        selector: 'button[data-testid="open"]',
        confirmAction: true,
        requireVisible: true,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('page listener exploded');
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
