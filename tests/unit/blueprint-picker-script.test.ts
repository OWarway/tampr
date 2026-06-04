// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runTamprBlueprintPicker } from '../../src/blueprint/blueprint-picker-script';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('runTamprBlueprintPicker', () => {
  it('builds and saves a page-side draft flow', async () => {
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

    expect(document.body.textContent).toContain('Good selector');
    expect(document.body.textContent).toContain('Unique class-based target.');
    expect(document.body.textContent).toContain('aside.subscribe.panel');
    expect(document.body.textContent).toContain('Visual');
    expect(document.body.textContent).toContain('Actions');
    expect(document.body.textContent).toContain('Data');
    expect(document.body.textContent).toContain('Advanced');
    expect(document.body.textContent).toContain('Remove overlay');
    expect(document.body.textContent).toContain('Make sticky');
    expect(document.body.textContent).toContain('Widen');
    expect(document.body.textContent).toContain('Print cleanup');
    expect(document.body.textContent).toContain('Custom code');

    const hideButton = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === 'Hide',
    );

    hideButton?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    expect(document.body.textContent).toContain('1. Hide');

    const runButton = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === 'Run',
    );

    runButton?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    expect(
      document.querySelector('[data-tampr-blueprint-preview]')?.textContent,
    ).toContain('aside.subscribe.panel { display: none !important; }');

    const saveButton = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === 'Save',
    );

    saveButton?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    await expect(resultPromise).resolves.toEqual({
      ok: true,
      action: 'hide',
      draft: {
        nodes: [
          {
            action: 'hide',
            label: 'Hide Join the list',
            pick: {
              label: 'Join the list',
              selector: 'aside.subscribe.panel',
              selectorMeta: {
                matchCount: 1,
                segmentCount: 1,
                strategy: 'class',
                usesNthOfType: false,
              },
              tagName: 'aside',
              text: 'Join the list',
            },
          },
        ],
      },
      pick: {
        label: 'Join the list',
        selector: 'aside.subscribe.panel',
        selectorMeta: {
          matchCount: 1,
          segmentCount: 1,
          strategy: 'class',
          usesNthOfType: false,
        },
        tagName: 'aside',
        text: 'Join the list',
      },
    });
    expect(document.querySelector('[data-tampr-blueprint-picker]')).toBeNull();
    expect(document.querySelector('[data-tampr-blueprint-preview]')).toBeNull();
  });

  it('offers parent and child selector targets before adding actions', async () => {
    document.body.innerHTML = `
      <main>
        <article data-testid="card">
          <button data-testid="open"><span data-testid="label">Open</span></button>
        </article>
      </main>
    `;
    const button = document.querySelector('button') as HTMLButtonElement;
    const label = document.querySelector('span') as HTMLSpanElement;

    stubElementFromPoint(button);
    stubRect(button);
    stubRect(label);

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

    expect(document.body.textContent).toContain('Selector target');
    expect(document.body.textContent).toContain('Current');
    expect(document.body.textContent).toContain('Parent: article');
    expect(document.body.textContent).toContain('Child: span');

    clickButton('Child: span');
    expect(document.body.textContent).toContain('span[data-testid="label"]');

    clickButton('Extract');
    clickButton('Save');

    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      draft: {
        nodes: [
          {
            action: 'extract-text',
            pick: {
              selector: 'span[data-testid="label"]',
            },
          },
        ],
      },
      pick: {
        selector: 'span[data-testid="label"]',
      },
    });
  });

  it('returns new CSS action choices from the palette', async () => {
    document.body.innerHTML = `
      <main>
        <article class="content">Readable article</article>
      </main>
    `;
    const target = document.querySelector('article') as HTMLElement;

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

    const widenButton = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === 'Widen',
    );

    widenButton?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    const saveButton = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === 'Save',
    );

    saveButton?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      action: 'widen',
      draft: {
        nodes: [
          {
            action: 'widen',
          },
        ],
      },
      pick: {
        selector: 'article.content',
      },
    });
  });

  it('returns only selector data in selector mode', async () => {
    document.body.innerHTML = `
      <main>
        <button data-testid="buy">Buy now</button>
      </main>
    `;
    const target = document.querySelector('button') as HTMLElement;

    stubElementFromPoint(target);
    stubRect(target);

    const resultPromise = runTamprBlueprintPicker({ mode: 'selector' });

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

    expect(document.body.textContent).toContain('Use selector');
    expect(document.body.textContent).not.toContain('Remove overlay');

    const useSelectorButton = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === 'Use selector',
    );

    useSelectorButton?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    await expect(resultPromise).resolves.toEqual({
      ok: true,
      pick: {
        label: 'Buy now',
        selector: 'button[data-testid="buy"]',
        selectorMeta: {
          matchCount: 1,
          segmentCount: 1,
          strategy: 'attribute',
          usesNthOfType: false,
        },
        tagName: 'button',
        text: 'Buy now',
      },
    });
  });

  it('continues picking elements and saves chained automation actions', async () => {
    document.body.innerHTML = `
      <main>
        <button data-testid="open">Open</button>
        <h1 data-testid="headline">Deal</h1>
      </main>
    `;
    const button = document.querySelector('button') as HTMLElement;
    const headline = document.querySelector('h1') as HTMLElement;
    let currentTarget = button;

    stubElementFromPointGetter(() => currentTarget);
    stubRect(button);
    stubRect(headline);

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

    clickButton('Click');
    clickButton('Pick next');

    currentTarget = headline;
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

    clickButton('Extract');
    clickButton('Custom code');
    expect(document.body.textContent).toContain('1. Click');
    expect(document.body.textContent).toContain('2. Extract text');
    expect(document.body.textContent).toContain('3. Custom code');

    clickButton('Save');

    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      draft: {
        nodes: [
          {
            action: 'click',
            pick: {
              selector: 'button[data-testid="open"]',
            },
          },
          {
            action: 'extract-text',
            variableName: 'value2',
            pick: {
              selector: 'h1[data-testid="headline"]',
            },
          },
          {
            action: 'custom-code',
            code: expect.stringContaining('values stores'),
            pick: {
              selector: 'h1[data-testid="headline"]',
            },
          },
        ],
      },
    });
  });

  it('runs page-side click drafts through the interactive ancestor', async () => {
    document.body.innerHTML = `
      <main>
        <button data-testid="open"><span class="label">Open panel</span></button>
      </main>
    `;
    const button = document.querySelector('button') as HTMLButtonElement;
    const label = document.querySelector('span.label') as HTMLSpanElement;
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
    stubElementFromPoint(label);
    stubRect(button);
    stubRect(label);

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

    clickButton('Click');
    expect(document.body.textContent).toContain('event.isTrusted === false');
    clickButton('Run');
    await flushPromises();

    expect(document.body.textContent).toContain('Run complete');
    expect(observed).toEqual([
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ]);

    clickButton('Save');

    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      draft: {
        nodes: [
          {
            action: 'click',
            pick: {
              selector: 'span.label',
            },
          },
        ],
      },
    });
  });

  it('returns a draft session before click navigation tears down the page', async () => {
    document.body.innerHTML = `
      <main>
        <a href="https://docs.example.com/next"><span class="label">Next</span></a>
      </main>
    `;
    const anchor = document.querySelector('a') as HTMLAnchorElement;
    const label = document.querySelector('span.label') as HTMLSpanElement;
    const observed: string[] = [];

    for (const type of [
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ]) {
      anchor.addEventListener(type, (event) => {
        observed.push(event.type);
        event.preventDefault();
      });
    }
    stubElementFromPoint(label);
    stubRect(anchor);
    stubRect(label);

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

    clickButton('Click');
    clickButton('Run');

    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      reason: 'navigating',
      draft: {
        nodes: [
          {
            action: 'click',
            pick: {
              selector: 'span.label',
            },
          },
        ],
      },
    });
    await flushPromises();

    expect(observed).toEqual([
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ]);
    expect(document.querySelector('[data-tampr-blueprint-picker]')).toBeNull();
  });

  it('reopens an existing draft when resumed after navigation', async () => {
    document.body.innerHTML = `
      <main>
        <h1 data-testid="headline">Next page</h1>
      </main>
    `;
    const resultPromise = runTamprBlueprintPicker({
      draft: {
        nodes: [
          {
            action: 'click',
            label: 'Click Next',
            pick: {
              label: 'Next',
              selector: 'a > span.label',
              selectorMeta: {
                matchCount: 1,
                segmentCount: 2,
                strategy: 'path',
                usesNthOfType: false,
              },
              tagName: 'span',
              text: 'Next',
            },
          },
        ],
      },
    });

    expect(document.body.textContent).toContain('1. Click');
    expect(document.body.textContent).toContain('event.isTrusted === false');

    clickButton('Save');

    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      draft: {
        nodes: [
          {
            action: 'click',
            label: 'Click Next',
          },
        ],
      },
    });
  });

  it('edits page-side draft step settings before saving', async () => {
    document.body.innerHTML = `
      <main>
        <input data-testid="email" aria-label="Email" />
        <h1 data-testid="headline">Deal</h1>
      </main>
    `;
    const input = document.querySelector('input') as HTMLElement;
    const headline = document.querySelector('h1') as HTMLElement;
    let currentTarget = input;

    stubElementFromPointGetter(() => currentTarget);
    stubRect(input);
    stubRect(headline);

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

    clickButton('Set value');
    setDraftField('Blueprint set value', 'oliver@example.com');
    clickButton('Pick next');

    currentTarget = headline;
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

    clickButton('Extract');
    setDraftField('Blueprint variable name', 'dealText');
    clickButton('Extract list');
    setDraftField('Blueprint variable name', 'dealItems');
    setDraftField('Blueprint max list items', '12');
    setDraftField(
      'Blueprint list fields',
      ['title = h2', 'url = a @href'].join('\n'),
    );
    clickButton('Custom code');
    setDraftField(
      'Blueprint custom code',
      'values.dealLength = element.textContent?.trim().length ?? 0;',
    );
    setDraftCheckbox('Review blueprint custom code', true);
    clickButton('Save');

    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      draft: {
        nodes: [
          {
            action: 'set-value',
            value: 'oliver@example.com',
            pick: {
              selector: 'input[data-testid="email"]',
            },
          },
          {
            action: 'extract-text',
            variableName: 'dealText',
            pick: {
              selector: 'h1[data-testid="headline"]',
            },
          },
          {
            action: 'extract-list',
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
            maxItems: 12,
            variableName: 'dealItems',
            pick: {
              selector: 'h1[data-testid="headline"]',
            },
          },
          {
            action: 'custom-code',
            code: 'values.dealLength = element.textContent?.trim().length ?? 0;',
            reviewed: true,
            pick: {
              selector: 'h1[data-testid="headline"]',
            },
          },
        ],
      },
    });
  });

  it('maps extract-list fields by clicking children inside a selected row', async () => {
    document.body.innerHTML = `
      <main>
        <article class="deal-card">
          <h2>First deal</h2>
          <a href="/first">View deal</a>
        </article>
        <article class="deal-card">
          <h2>Second deal</h2>
          <a href="/second">View deal</a>
        </article>
      </main>
    `;
    const card = document.querySelector('article') as HTMLElement;
    const heading = document.querySelector('h2') as HTMLElement;
    const link = document.querySelector('a') as HTMLAnchorElement;
    let currentTarget = card;

    stubElementFromPointGetter(() => currentTarget);
    stubRect(card);
    stubRect(heading);
    stubRect(link);

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

    clickButton('Extract list');

    clickButton('Pick field');
    currentTarget = heading;
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

    expect(
      (
        document.querySelector(
          '[aria-label="Blueprint list fields"]',
        ) as HTMLTextAreaElement
      ).value,
    ).toContain('title = h2');

    clickButton('Pick field');
    currentTarget = link;
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

    clickButton('Save');

    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      draft: {
        nodes: [
          {
            action: 'extract-list',
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
            pick: {
              selector: 'article.deal-card',
            },
          },
        ],
      },
    });
  });

  it('refuses page-side custom code preview until the code is reviewed', async () => {
    document.body.innerHTML = `
      <main>
        <h1 data-testid="headline">Deal</h1>
      </main>
    `;
    const headline = document.querySelector('h1') as HTMLElement;

    stubElementFromPoint(headline);
    stubRect(headline);

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

    clickButton('Custom code');
    setDraftField('Blueprint custom code', 'values.ready = true;');
    clickButton('Run');
    await flushPromises();

    expect(document.body.textContent).toContain(
      'Custom code needs review before running.',
    );

    clickButton('Cancel');
    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      reason: 'cancelled',
    });
  });

  it('reorders and removes draft steps before saving', async () => {
    document.body.innerHTML = `
      <main>
        <button data-testid="open">Open</button>
      </main>
    `;
    const button = document.querySelector('button') as HTMLElement;

    stubElementFromPoint(button);
    stubRect(button);

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

    clickButton('Wait');
    clickButton('Click');
    clickButton('Custom code');

    clickButton('2. Click');
    clickButton('Up');
    clickButton('3. Custom code');
    clickButton('Remove');
    clickButton('Save');

    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      draft: {
        nodes: [
          {
            action: 'click',
          },
          {
            action: 'wait-for-element',
          },
        ],
      },
    });
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

  it('returns positional selector metadata when stable hooks are unavailable', async () => {
    document.body.innerHTML = `
      <main>
        <section>
          <button>First</button>
          <button>Second</button>
        </section>
      </main>
    `;
    const target = [...document.querySelectorAll('button')][1] as HTMLElement;

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

    expect(document.body.textContent).toContain('Fragile selector');
    expect(document.body.textContent).toContain('Depends on page position.');

    const highlightButton = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === 'Highlight',
    );

    highlightButton?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    const saveButton = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === 'Save',
    );

    saveButton?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      action: 'highlight',
      draft: {
        nodes: [
          {
            action: 'highlight',
          },
        ],
      },
      pick: {
        selector: 'button:nth-of-type(2)',
        selectorMeta: {
          matchCount: 1,
          segmentCount: 1,
          strategy: 'position',
          usesNthOfType: true,
        },
      },
    });
  });
});

function stubElementFromPoint(element: Element): void {
  stubElementFromPointGetter(() => element);
}

function stubElementFromPointGetter(getElement: () => Element): void {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: vi.fn(() => getElement()),
  });
}

function clickButton(label: string): void {
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );

  button?.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true }),
  );
}

function setDraftField(label: string, value: string): void {
  const field = document.querySelector(`[aria-label="${label}"]`);

  expect(field).toBeTruthy();

  if (
    field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement
  ) {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function setDraftCheckbox(label: string, checked: boolean): void {
  const field = document.querySelector(`[aria-label="${label}"]`);

  expect(field).toBeTruthy();

  if (field instanceof HTMLInputElement) {
    field.checked = checked;
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

async function flushPromises(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 0));
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
