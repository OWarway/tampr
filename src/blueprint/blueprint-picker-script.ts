import type {
  BlueprintAction,
  BlueprintElementPick,
  BlueprintFlowDraftNode,
} from '../domain/blueprint-snippets';
import type { BlueprintNodeAction } from '../domain/blueprints/actions';

export type BlueprintDraftFlow = {
  nodes: BlueprintFlowDraftNode[];
};

export type BlueprintPickerResponse =
  | {
      action?: BlueprintAction;
      draft?: BlueprintDraftFlow;
      ok: true;
      pick: BlueprintElementPick;
    }
  | {
      message: string;
      ok: false;
      reason: 'busy' | 'cancelled' | 'unavailable';
    };

type BlueprintPickerOptions = {
  mode?: 'create' | 'selector';
};

// Chrome serializes only this function for injection, so the picker helpers stay nested.
export async function runTamprBlueprintPicker({
  mode = 'create',
}: BlueprintPickerOptions = {}): Promise<BlueprintPickerResponse> {
  type PickerWindow = Window & {
    __tamprBlueprintPickerActive?: boolean;
  };

  const pickerWindow = window as PickerWindow;

  if (pickerWindow.__tamprBlueprintPickerActive) {
    return {
      ok: false,
      reason: 'busy',
      message: 'The Tampr Blueprint picker is already running.',
    };
  }

  if (!document.body) {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'This page is not ready for element picking.',
    };
  }

  pickerWindow.__tamprBlueprintPickerActive = true;

  return await new Promise<BlueprintPickerResponse>((resolve) => {
    let hoverTarget: Element | undefined;
    let selectedDraftIndex = -1;
    let selectedPick: BlueprintElementPick | undefined;
    let selectedTarget: Element | undefined;
    let previewStyle: HTMLStyleElement | undefined;

    type DraftNode = BlueprintFlowDraftNode;

    const draftNodes: DraftNode[] = [];

    const root = document.createElement('div');
    const highlight = document.createElement('div');
    const banner = document.createElement('div');
    const flowBar = document.createElement('div');
    const flowTitle = document.createElement('strong');
    const flowSteps = document.createElement('div');
    const flowActions = document.createElement('div');
    const moveUpButton = document.createElement('button');
    const moveDownButton = document.createElement('button');
    const removeButton = document.createElement('button');
    const runButton = document.createElement('button');
    const saveButton = document.createElement('button');
    const cancelButton = document.createElement('button');
    const palette = document.createElement('div');
    const paletteInfo = document.createElement('div');
    const paletteTitle = document.createElement('strong');
    const paletteSelector = document.createElement('code');
    const paletteDetail = document.createElement('span');
    const paletteActions = document.createElement('div');

    root.setAttribute('data-tampr-blueprint-picker', 'true');
    root.style.cssText = [
      'all: initial',
      'color-scheme: light',
      'font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      'position: fixed',
      'inset: 0',
      'pointer-events: none',
      'z-index: 2147483647',
    ].join(';');

    highlight.style.cssText = [
      'background: rgba(20, 89, 77, 0.12)',
      'border: 2px solid #14594d',
      'border-radius: 6px',
      'box-shadow: 0 0 0 9999px rgba(20, 32, 27, 0.18)',
      'box-sizing: border-box',
      'display: none',
      'left: 0',
      'pointer-events: none',
      'position: fixed',
      'top: 0',
      'transform: translate3d(0, 0, 0)',
    ].join(';');

    banner.style.cssText = [
      'background: #14201b',
      'border: 1px solid rgba(255, 255, 255, 0.18)',
      'border-radius: 8px',
      'box-shadow: 0 16px 40px rgba(20, 32, 27, 0.22)',
      'color: #f7fbf8',
      'font: 700 13px/1.35 Inter, ui-sans-serif, system-ui, sans-serif',
      'left: 50%',
      'max-width: min(440px, calc(100vw - 28px))',
      'padding: 10px 12px',
      'pointer-events: none',
      'position: fixed',
      'top: 14px',
      'transform: translateX(-50%)',
    ].join(';');
    banner.textContent =
      mode === 'selector'
        ? 'Tampr Blueprint: pick a replacement element.'
        : 'Tampr Blueprint: pick an element, choose actions, then run or save the flow.';

    flowBar.style.cssText = [
      'align-items: center',
      'background: #14201b',
      'border: 1px solid rgba(255, 255, 255, 0.18)',
      'border-radius: 8px',
      'box-shadow: 0 16px 40px rgba(20, 32, 27, 0.22)',
      'color: #f7fbf8',
      'display: none',
      'gap: 10px',
      'left: 50%',
      'max-width: min(860px, calc(100vw - 28px))',
      'min-height: 42px',
      'padding: 8px 10px',
      'pointer-events: auto',
      'position: fixed',
      'top: 14px',
      'transform: translateX(-50%)',
    ].join(';');

    flowTitle.style.cssText = [
      'font: 900 12px/1.2 Inter, ui-sans-serif, system-ui, sans-serif',
      'white-space: nowrap',
    ].join(';');
    flowTitle.textContent = 'Tampr Blueprint';

    flowSteps.style.cssText = [
      'display: flex',
      'flex: 1 1 auto',
      'gap: 6px',
      'min-width: 0',
      'overflow: hidden',
    ].join(';');

    flowActions.style.cssText = [
      'display: flex',
      'flex: 0 0 auto',
      'gap: 6px',
    ].join(';');

    moveUpButton.type = 'button';
    moveUpButton.textContent = 'Up';
    moveUpButton.style.cssText = flowButtonStyle('#53645b');
    moveUpButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveSelectedDraftNode(-1);
    });

    moveDownButton.type = 'button';
    moveDownButton.textContent = 'Down';
    moveDownButton.style.cssText = flowButtonStyle('#53645b');
    moveDownButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveSelectedDraftNode(1);
    });

    removeButton.type = 'button';
    removeButton.textContent = 'Remove';
    removeButton.style.cssText = flowButtonStyle('#7d4a16');
    removeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeSelectedDraftNode();
    });

    runButton.type = 'button';
    runButton.textContent = 'Run';
    runButton.style.cssText = flowButtonStyle('#14594d');
    runButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void runDraft();
    });

    saveButton.type = 'button';
    saveButton.textContent = 'Save';
    saveButton.style.cssText = flowButtonStyle('#d44d3a');
    saveButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      saveDraft();
    });

    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = flowButtonStyle('#53645b');
    cancelButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    });

    flowActions.append(
      moveUpButton,
      moveDownButton,
      removeButton,
      runButton,
      saveButton,
      cancelButton,
    );
    flowBar.append(flowTitle, flowSteps, flowActions);

    palette.style.cssText = [
      'background: #f7fbf8',
      'border: 1px solid #b9cac1',
      'border-radius: 8px',
      'box-shadow: 0 18px 46px rgba(20, 32, 27, 0.24)',
      'display: none',
      'gap: 8px',
      'max-width: min(420px, calc(100vw - 24px))',
      'padding: 8px',
      'pointer-events: auto',
      'position: fixed',
    ].join(';');

    paletteInfo.style.cssText = [
      'background: #fff',
      'border: 1px solid #dbe3de',
      'border-left: 4px solid #79a78f',
      'border-radius: 7px',
      'color: #14201b',
      'display: grid',
      'font: 700 12px/1.35 Inter, ui-sans-serif, system-ui, sans-serif',
      'gap: 5px',
      'min-width: 220px',
      'padding: 9px 10px',
    ].join(';');
    paletteTitle.style.cssText = ['color: #14594d', 'font-size: 12px'].join(
      ';',
    );
    paletteSelector.style.cssText = [
      'background: #edf4ef',
      'border-radius: 5px',
      'color: #29463d',
      'display: block',
      'font: 700 11px/1.45 ui-monospace, "SFMono-Regular", Consolas, monospace',
      'max-width: 360px',
      'overflow: hidden',
      'padding: 5px 6px',
      'text-overflow: ellipsis',
      'white-space: nowrap',
    ].join(';');
    paletteDetail.style.cssText = [
      'color: #53645b',
      'font-size: 11px',
      'font-weight: 700',
    ].join(';');
    paletteInfo.append(paletteTitle, paletteSelector, paletteDetail);

    paletteActions.style.cssText = [
      'display: flex',
      'flex-wrap: wrap',
      'gap: 8px',
    ].join(';');
    if (mode === 'selector') {
      paletteActions.append(
        createPaletteButton('Use selector', '#14594d', () => finish()),
        createPaletteButton('Cancel', '#53645b', cancel),
      );
    } else {
      paletteActions.append(
        createPaletteButton('Hide', '#14594d', () => appendAction('hide')),
        createPaletteButton('Highlight', '#d44d3a', () =>
          appendAction('highlight'),
        ),
        createPaletteButton('Remove overlay', '#7d4a16', () =>
          appendAction('remove-overlay'),
        ),
        createPaletteButton('Make sticky', '#2d7d56', () =>
          appendAction('sticky'),
        ),
        createPaletteButton('Widen', '#29463d', () => appendAction('widen')),
        createPaletteButton('Print cleanup', '#53645b', () =>
          appendAction('print-cleanup'),
        ),
        createPaletteButton('Wait', '#14594d', () =>
          appendAction('wait-for-element'),
        ),
        createPaletteButton('Click', '#29463d', () => appendAction('click')),
        createPaletteButton('Set value', '#7d4a16', () =>
          appendAction('set-value'),
        ),
        createPaletteButton('Extract', '#2d7d56', () =>
          appendAction('extract-text'),
        ),
        createPaletteButton('Download JSON', '#29463d', () =>
          appendAction('download-json'),
        ),
        createPaletteButton('Custom code', '#53645b', () =>
          appendAction('custom-code'),
        ),
        createPaletteButton('Pick next', '#14594d', pickNext),
        createPaletteButton('Cancel', '#53645b', cancel),
      );
    }
    palette.append(paletteInfo, paletteActions);

    root.append(highlight, banner, flowBar, palette);
    document.body.append(root);

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', redraw, true);
    window.addEventListener('scroll', redraw, true);

    function createPaletteButton(
      label: string,
      color: string,
      onClick: () => void,
    ): HTMLButtonElement {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.style.cssText = [
        'appearance: none',
        `background: ${color}`,
        'border: 1px solid transparent',
        'border-radius: 6px',
        'color: #fff',
        'cursor: pointer',
        'font: 800 12px/1 Inter, ui-sans-serif, system-ui, sans-serif',
        'min-height: 34px',
        'padding: 0 11px',
      ].join(';');
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      });
      return button;
    }

    function flowButtonStyle(color: string): string {
      return [
        'appearance: none',
        `background: ${color}`,
        'border: 1px solid transparent',
        'border-radius: 6px',
        'color: #fff',
        'cursor: pointer',
        'font: 900 12px/1 Inter, ui-sans-serif, system-ui, sans-serif',
        'min-height: 30px',
        'padding: 0 10px',
      ].join(';');
    }

    function handleMouseMove(event: MouseEvent): void {
      if (selectedTarget) {
        return;
      }

      const nextTarget = pickElementAt(event.clientX, event.clientY);

      if (!nextTarget || nextTarget === hoverTarget) {
        return;
      }

      hoverTarget = nextTarget;
      drawHighlight(nextTarget);
    }

    function handleClick(event: MouseEvent): void {
      const targetNode = event.target;

      if (targetNode instanceof Node && root.contains(targetNode)) {
        return;
      }

      const target = hoverTarget ?? pickElementAt(event.clientX, event.clientY);

      if (!target) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      selectedTarget = target;
      selectedPick = describePick(target);
      drawHighlight(target);
      updatePaletteInfo(selectedPick);
      showPalette(target);
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancel();
      }
    }

    function redraw(): void {
      const target = selectedTarget ?? hoverTarget;

      if (target) {
        drawHighlight(target);
      }

      if (selectedTarget) {
        showPalette(selectedTarget);
      }
    }

    function pickElementAt(
      clientX: number,
      clientY: number,
    ): Element | undefined {
      const element = document.elementFromPoint(clientX, clientY);

      if (!element || root.contains(element)) {
        return undefined;
      }

      const tagName = element.localName.toLowerCase();

      if (tagName === 'html' || tagName === 'body') {
        return undefined;
      }

      return element;
    }

    function drawHighlight(target: Element): void {
      const rect = target.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        highlight.style.display = 'none';
        return;
      }

      highlight.style.display = 'block';
      highlight.style.height = `${Math.max(1, rect.height)}px`;
      highlight.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
      highlight.style.width = `${Math.max(1, rect.width)}px`;
    }

    function showPalette(target: Element): void {
      const rect = target.getBoundingClientRect();
      const maxTop = Math.max(12, window.innerHeight - 56);
      const maxLeft = Math.max(12, window.innerWidth - 432);
      const top = Math.min(maxTop, Math.max(12, rect.bottom + 8));
      const left = Math.min(maxLeft, Math.max(12, rect.left));

      palette.style.display = 'flex';
      palette.style.flexDirection = 'column';
      palette.style.left = `${left}px`;
      palette.style.top = `${top}px`;
    }

    function appendAction(action: BlueprintNodeAction): void {
      if (!selectedTarget) {
        return;
      }

      const pick = selectedPick ?? describePick(selectedTarget);
      const node: DraftNode = {
        action,
        label: `${nodeLabel(action)} ${pick.label}`.slice(0, 120),
        pick,
      };

      if (action === 'set-value') {
        node.value = window.prompt('Value to set for this field', '') ?? '';
      }

      if (action === 'extract-text') {
        node.variableName = uniqueVariableName(draftNodes.length + 1);
      }

      if (action === 'custom-code') {
        node.code = [
          '// element is the selected page element.',
          '// values stores extracted Blueprint values.',
        ].join('\n');
      }

      draftNodes.push(node);
      selectedDraftIndex = draftNodes.length - 1;
      updateFlowBar();
      updatePaletteInfo(pick);
    }

    function pickNext(): void {
      selectedPick = undefined;
      selectedTarget = undefined;
      hoverTarget = undefined;
      palette.style.display = 'none';
      highlight.style.display = 'none';
      banner.style.display = draftNodes.length > 0 ? 'none' : '';
    }

    function saveDraft(): void {
      const firstNode = draftNodes[0];

      if (!firstNode) {
        return;
      }

      cleanup();
      resolve({
        ok: true,
        draft: { nodes: draftNodes },
        pick: firstNode.pick,
        ...(isCssAction(firstNode.action) ? { action: firstNode.action } : {}),
      });
    }

    function moveSelectedDraftNode(direction: -1 | 1): void {
      if (selectedDraftIndex < 0) {
        return;
      }

      const targetIndex = selectedDraftIndex + direction;

      if (targetIndex < 0 || targetIndex >= draftNodes.length) {
        return;
      }

      const [node] = draftNodes.splice(selectedDraftIndex, 1);

      if (!node) {
        return;
      }

      draftNodes.splice(targetIndex, 0, node);
      selectedDraftIndex = targetIndex;
      updateFlowBar();
    }

    function removeSelectedDraftNode(): void {
      if (selectedDraftIndex < 0) {
        return;
      }

      draftNodes.splice(selectedDraftIndex, 1);
      selectedDraftIndex = Math.min(selectedDraftIndex, draftNodes.length - 1);
      updateFlowBar();
    }

    async function runDraft(): Promise<void> {
      if (draftNodes.length === 0) {
        return;
      }

      const values: Record<string, unknown> = {};

      previewStyle?.remove();
      previewStyle = document.createElement('style');
      previewStyle.setAttribute('data-tampr-blueprint-preview', 'true');
      previewStyle.textContent = draftNodes
        .map(previewCssForNode)
        .filter(Boolean)
        .join('\n\n');

      if (previewStyle.textContent) {
        document.head.append(previewStyle);
      }

      flowTitle.textContent = 'Running Blueprint';

      try {
        for (const node of draftNodes) {
          if (isCssAction(node.action)) {
            continue;
          }

          if (node.action === 'download-json') {
            continue;
          }

          const element = await waitForDraftElement(node);

          if (node.action === 'wait-for-element') {
            continue;
          }

          if (node.action === 'click') {
            assertSafeClickTarget(element);
            (element as HTMLElement).click();
            continue;
          }

          if (node.action === 'set-value') {
            setDraftFieldValue(element, node.value ?? '');
            continue;
          }

          if (node.action === 'extract-text') {
            values[node.variableName ?? uniqueVariableName(1)] =
              visibleText(element);
            continue;
          }

          if (node.action === 'custom-code') {
            const run = new Function(
              'element',
              'values',
              `"use strict";\n${node.code ?? ''}`,
            );

            await run(element, values);
          }
        }

        flowTitle.textContent = 'Run complete';
      } catch (error: unknown) {
        flowTitle.textContent =
          error instanceof Error ? error.message : 'Run failed';
      }
    }

    function updateFlowBar(): void {
      const hasDraft = draftNodes.length > 0;

      flowBar.style.display = hasDraft ? 'flex' : 'none';
      banner.style.display = hasDraft ? 'none' : '';
      flowTitle.textContent = `Tampr Blueprint`;
      if (!hasDraft) {
        selectedDraftIndex = -1;
      }
      flowSteps.replaceChildren(
        ...draftNodes.map((node, index) => {
          const step = document.createElement('button');

          step.type = 'button';
          step.textContent = `${index + 1}. ${nodeLabel(node.action)}`;
          step.style.cssText = [
            'appearance: none',
            `background: ${
              selectedDraftIndex === index
                ? 'rgba(255, 255, 255, 0.24)'
                : 'rgba(255, 255, 255, 0.1)'
            }`,
            `border: 1px solid ${
              selectedDraftIndex === index
                ? 'rgba(255, 255, 255, 0.46)'
                : 'rgba(255, 255, 255, 0.16)'
            }`,
            'border-radius: 999px',
            'color: #f7fbf8',
            'cursor: pointer',
            'font: 800 11px/1 Inter, ui-sans-serif, system-ui, sans-serif',
            'max-width: 150px',
            'overflow: hidden',
            'padding: 6px 8px',
            'text-overflow: ellipsis',
            'white-space: nowrap',
          ].join(';');
          step.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            selectedDraftIndex = index;
            updateFlowBar();
          });

          return step;
        }),
      );
      moveUpButton.disabled = !hasDraft || selectedDraftIndex <= 0;
      moveDownButton.disabled =
        !hasDraft ||
        selectedDraftIndex < 0 ||
        selectedDraftIndex >= draftNodes.length - 1;
      removeButton.disabled = !hasDraft || selectedDraftIndex < 0;
      runButton.toggleAttribute('disabled', !hasDraft);
      saveButton.toggleAttribute('disabled', !hasDraft);
    }

    function previewCssForNode(node: DraftNode): string {
      switch (node.action) {
        case 'hide':
          return `${node.pick.selector} { display: none !important; }`;
        case 'highlight':
          return `${node.pick.selector} { outline: 3px solid #d44d3a !important; outline-offset: 3px !important; }`;
        case 'remove-overlay':
          return `${node.pick.selector} { display: none !important; pointer-events: none !important; }\nhtml, body { overflow: auto !important; }`;
        case 'sticky':
          return `${node.pick.selector} { position: sticky !important; top: 0 !important; z-index: 2147483646 !important; }`;
        case 'widen':
          return `${node.pick.selector} { max-width: none !important; width: min(100%, 1200px) !important; }`;
        case 'print-cleanup':
          return `@media print { ${node.pick.selector} { display: none !important; } }`;
        default:
          return '';
      }
    }

    function isCssAction(
      action: BlueprintNodeAction,
    ): action is BlueprintAction {
      return (
        action === 'hide' ||
        action === 'highlight' ||
        action === 'remove-overlay' ||
        action === 'sticky' ||
        action === 'widen' ||
        action === 'print-cleanup'
      );
    }

    function nodeLabel(action: BlueprintNodeAction): string {
      switch (action) {
        case 'hide':
          return 'Hide';
        case 'highlight':
          return 'Highlight';
        case 'remove-overlay':
          return 'Remove overlay';
        case 'sticky':
          return 'Make sticky';
        case 'widen':
          return 'Widen';
        case 'print-cleanup':
          return 'Print cleanup';
        case 'wait-for-element':
          return 'Wait';
        case 'click':
          return 'Click';
        case 'set-value':
          return 'Set value';
        case 'extract-text':
          return 'Extract text';
        case 'download-json':
          return 'Download JSON';
        case 'custom-code':
          return 'Custom code';
      }
    }

    function uniqueVariableName(index: number): string {
      return `value${index}`;
    }

    async function waitForDraftElement(node: DraftNode): Promise<Element> {
      const startedAt = Date.now();

      while (Date.now() - startedAt <= 5000) {
        const element = document.querySelector(node.pick.selector);

        if (element && isVisibleElement(element)) {
          return element;
        }

        await sleep(100);
      }

      throw new Error(`Step ${nodeLabel(node.action)} could not find target.`);
    }

    function isVisibleElement(element: Element): boolean {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);

      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.visibility !== 'collapse' &&
        style.opacity !== '0'
      );
    }

    function assertSafeClickTarget(element: Element): void {
      const copy = [
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.textContent,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const riskyWords = [
        'buy',
        'checkout',
        'delete',
        'order',
        'pay',
        'purchase',
        'publish',
        'remove',
        'send',
        'submit',
      ];

      if (!(element instanceof HTMLElement)) {
        throw new Error('Click target is not an HTML element.');
      }

      if (riskyWords.some((word) => copy.includes(word))) {
        throw new Error('Click target needs manual review.');
      }
    }

    function setDraftFieldValue(element: Element, value: string): void {
      if (
        !(
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
        )
      ) {
        throw new Error('Set value target is not a form field.');
      }

      if (element instanceof HTMLInputElement) {
        const blockedTypes = [
          'button',
          'checkbox',
          'file',
          'hidden',
          'password',
          'radio',
          'submit',
        ];

        if (blockedTypes.includes(element.type)) {
          throw new Error('Set value target is a protected field.');
        }
      }

      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function sleep(ms: number): Promise<void> {
      return new Promise((resolveSleep) => window.setTimeout(resolveSleep, ms));
    }

    function finish(action?: BlueprintAction): void {
      if (!selectedTarget) {
        return;
      }

      const pick = selectedPick ?? describePick(selectedTarget);
      cleanup();
      resolve(action ? { ok: true, action, pick } : { ok: true, pick });
    }

    function cancel(): void {
      cleanup();
      resolve({
        ok: false,
        reason: 'cancelled',
        message: 'Blueprint picking was cancelled.',
      });
    }

    function cleanup(): void {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', redraw, true);
      window.removeEventListener('scroll', redraw, true);
      previewStyle?.remove();
      root.remove();
      delete pickerWindow.__tamprBlueprintPickerActive;
    }

    function describePick(target: Element): BlueprintElementPick {
      const text = visibleText(target);
      const selector = createSelector(target);
      const label =
        target.getAttribute('aria-label') ??
        target.getAttribute('title') ??
        text ??
        target.id ??
        target.localName.toLowerCase();
      const pick: BlueprintElementPick = {
        label: truncate(label, 80),
        selector: selector.value,
        selectorMeta: selector.meta,
        tagName: target.localName.toLowerCase(),
      };

      if (text) {
        pick.text = text;
      }

      return pick;
    }

    function visibleText(target: Element): string | undefined {
      const text = (target.textContent ?? '').replace(/\s+/g, ' ').trim();

      return text ? truncate(text, 120) : undefined;
    }

    type LocalSelectorQuality = 'strong' | 'good' | 'fragile';

    type LocalSelectorAssessment = {
      detail: string;
      quality: LocalSelectorQuality;
    };

    function updatePaletteInfo(pick: BlueprintElementPick): void {
      const assessment = selectorAssessment(pick.selectorMeta);
      const color = selectorQualityColor(assessment.quality);

      paletteInfo.style.borderLeftColor = color;
      paletteTitle.style.color = color;
      paletteTitle.textContent = `${capitalize(assessment.quality)} selector`;
      paletteSelector.textContent = pick.selector;
      paletteSelector.title = pick.selector;
      paletteDetail.textContent = assessment.detail;
    }

    function selectorAssessment(
      meta: LocalSelectorResult['meta'],
    ): LocalSelectorAssessment {
      if (meta.matchCount === 0) {
        return {
          quality: 'fragile',
          detail: 'Selector did not match after generation.',
        };
      }

      if (meta.matchCount > 1) {
        return {
          quality: 'fragile',
          detail: `Selector matches ${meta.matchCount} elements.`,
        };
      }

      if (meta.usesNthOfType || meta.strategy === 'position') {
        return {
          quality: 'fragile',
          detail: 'Depends on page position.',
        };
      }

      if (meta.strategy === 'id' || meta.strategy === 'attribute') {
        return {
          quality: 'strong',
          detail: 'Uses a stable unique page marker.',
        };
      }

      if (meta.strategy === 'class' && meta.segmentCount <= 2) {
        return {
          quality: 'good',
          detail: 'Unique class-based target.',
        };
      }

      return {
        quality: 'good',
        detail: 'Unique path-based target.',
      };
    }

    function selectorQualityColor(quality: LocalSelectorQuality): string {
      if (quality === 'strong') {
        return '#14594d';
      }

      return quality === 'good' ? '#29463d' : '#8e2b20';
    }

    function capitalize(value: string): string {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }

    type LocalSelectorStrategy =
      | 'id'
      | 'attribute'
      | 'class'
      | 'path'
      | 'position';

    type LocalSelectorSegment = {
      selector: string;
      strategy: LocalSelectorStrategy;
      usesNthOfType: boolean;
    };

    type LocalSelectorResult = {
      meta: {
        matchCount: number;
        segmentCount: number;
        strategy: LocalSelectorStrategy;
        usesNthOfType: boolean;
      };
      value: string;
    };

    function createSelector(target: Element): LocalSelectorResult {
      const rootDocument = target.ownerDocument;
      const directId = idSelector(target);

      if (directId) {
        const matchCount = queryCount(rootDocument, directId);

        if (matchCount === 1) {
          return selectorResult({
            matchCount,
            segments: [
              {
                selector: directId,
                strategy: 'id',
                usesNthOfType: false,
              },
            ],
            value: directId,
          });
        }
      }

      const segments: LocalSelectorSegment[] = [];
      let current: Element | null = target;

      while (
        current &&
        current.nodeType === Node.ELEMENT_NODE &&
        current !== rootDocument.documentElement
      ) {
        segments.unshift(selectorSegment(current));

        const selector = segments
          .map((segment) => segment.selector)
          .join(' > ');
        const matchCount = queryCount(rootDocument, selector);

        if (matchCount === 1) {
          return selectorResult({
            matchCount,
            segments,
            value: selector,
          });
        }

        current = current.parentElement;
      }

      const fallbackSelector =
        segments.map((segment) => segment.selector).join(' > ') ||
        target.localName.toLowerCase();

      return selectorResult({
        matchCount: queryCount(rootDocument, fallbackSelector),
        segments:
          segments.length > 0
            ? segments
            : [
                {
                  selector: fallbackSelector,
                  strategy: 'path',
                  usesNthOfType: false,
                },
              ],
        value: fallbackSelector,
      });
    }

    function selectorSegment(element: Element): LocalSelectorSegment {
      const tagName = element.localName.toLowerCase();
      const id = idSelector(element);

      if (id) {
        return {
          selector: `${tagName}${id}`,
          strategy: 'id',
          usesNthOfType: false,
        };
      }

      const attributeSelector = stableAttributeSelector(element);
      const classSelector = stableClassSelector(element);
      const baseStrategy = attributeSelector
        ? 'attribute'
        : classSelector
          ? 'class'
          : 'path';
      let segment = `${tagName}${attributeSelector ?? classSelector}`;
      let usesNthOfType = false;

      if (needsNthOfType(element, segment)) {
        segment = `${segment}:nth-of-type(${nthOfType(element)})`;
        usesNthOfType = true;
      }

      return {
        selector: segment,
        strategy: usesNthOfType ? 'position' : baseStrategy,
        usesNthOfType,
      };
    }

    type SelectorResultInput = {
      matchCount: number;
      segments: LocalSelectorSegment[];
      value: string;
    };

    function selectorResult({
      matchCount,
      segments,
      value,
    }: SelectorResultInput): LocalSelectorResult {
      return {
        value,
        meta: {
          matchCount,
          segmentCount: segments.length,
          strategy: selectorStrategy(segments),
          usesNthOfType: segments.some((segment) => segment.usesNthOfType),
        },
      };
    }

    function selectorStrategy(
      segments: readonly LocalSelectorSegment[],
    ): LocalSelectorStrategy {
      if (segments.some((segment) => segment.usesNthOfType)) {
        return 'position';
      }

      const targetSegment = segments.at(-1);

      if (
        targetSegment?.strategy === 'id' ||
        targetSegment?.strategy === 'attribute'
      ) {
        return targetSegment.strategy;
      }

      if (segments.length === 1 && targetSegment?.strategy === 'class') {
        return 'class';
      }

      return 'path';
    }

    function idSelector(element: Element): string | undefined {
      const id = element.getAttribute('id')?.trim();

      if (!id || !stableToken(id)) {
        return undefined;
      }

      return `#${escapeCssIdentifier(id)}`;
    }

    function stableAttributeSelector(element: Element): string | undefined {
      const attributeNames = [
        'data-testid',
        'data-test',
        'data-cy',
        'aria-label',
        'name',
      ];

      for (const attributeName of attributeNames) {
        const value = element.getAttribute(attributeName)?.trim();

        if (value && value.length <= 80 && !/[\n\r]/.test(value)) {
          return `[${attributeName}="${escapeCssString(value)}"]`;
        }
      }

      return undefined;
    }

    function stableClassSelector(element: Element): string {
      return Array.from(element.classList)
        .filter(stableToken)
        .slice(0, 3)
        .map((className) => `.${escapeCssIdentifier(className)}`)
        .join('');
    }

    function stableToken(value: string): boolean {
      const token = value.trim();

      if (token.length < 2 || token.length > 64) {
        return false;
      }

      if (!/[a-z]/i.test(token)) {
        return false;
      }

      return !/^[a-f0-9]{8,}$/i.test(token);
    }

    function needsNthOfType(element: Element, segment: string): boolean {
      const parent = element.parentElement;

      if (!parent) {
        return false;
      }

      let matches = 0;

      for (const child of Array.from(parent.children)) {
        if (child.matches(segment)) {
          matches += 1;
        }
      }

      return matches > 1;
    }

    function nthOfType(element: Element): number {
      let index = 1;
      let sibling = element.previousElementSibling;
      const tagName = element.localName;

      while (sibling) {
        if (sibling.localName === tagName) {
          index += 1;
        }

        sibling = sibling.previousElementSibling;
      }

      return index;
    }

    function queryCount(rootDocument: Document, selector: string): number {
      try {
        return [...rootDocument.querySelectorAll(selector)].filter(
          (element) => !root.contains(element),
        ).length;
      } catch {
        return 0;
      }
    }

    function escapeCssIdentifier(value: string): string {
      let escaped = '';

      for (let index = 0; index < value.length; index += 1) {
        const character = value[index] ?? '';
        const code = character.charCodeAt(0);
        const first = index === 0;
        const secondAfterDash = index === 1 && value[0] === '-';

        if (code === 0) {
          escaped += '\\fffd ';
        } else if (
          code <= 0x1f ||
          code === 0x7f ||
          (first && code >= 0x30 && code <= 0x39) ||
          (secondAfterDash && code >= 0x30 && code <= 0x39)
        ) {
          escaped += `\\${code.toString(16)} `;
        } else if (
          code >= 0x80 ||
          character === '-' ||
          character === '_' ||
          /[a-z0-9]/i.test(character)
        ) {
          escaped += character;
        } else {
          escaped += `\\${character}`;
        }
      }

      return escaped;
    }

    function escapeCssString(value: string): string {
      return value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\a ');
    }

    function truncate(value: string, maxLength: number): string {
      const trimmed = value.replace(/\s+/g, ' ').trim();

      if (trimmed.length <= maxLength) {
        return trimmed;
      }

      return trimmed.slice(0, maxLength - 1).trimEnd();
    }
  });
}
