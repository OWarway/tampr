import type {
  BlueprintAutomationNodeRunInput,
  BlueprintAutomationNodeRunResult,
} from '../shared/blueprint-messages';

export type BlueprintAutomationNodeRunResponse =
  | {
      ok: true;
      result: BlueprintAutomationNodeRunResult;
    }
  | {
      message: string;
      ok: false;
      reason:
        | 'invalid-selector'
        | 'cancelled'
        | 'requires-confirmation'
        | 'timeout'
        | 'unavailable'
        | 'unsafe-target'
        | 'unsupported';
    };

type BlueprintAutomationNodeRunResultBase = Pick<
  BlueprintAutomationNodeRunResult,
  'action' | 'durationMs' | 'firstTagName' | 'matchCount' | 'visibleCount'
>;

type BlueprintAutomationCancelInput = {
  runId: string;
};

type BlueprintAutomationWindow = Window & {
  __tamprBlueprintAutomationCancelled?: Record<string, boolean> | undefined;
};

export function cancelTamprBlueprintAutomationRun({
  runId,
}: BlueprintAutomationCancelInput): { ok: true } {
  const automationWindow = window as BlueprintAutomationWindow;

  automationWindow.__tamprBlueprintAutomationCancelled = {
    ...(automationWindow.__tamprBlueprintAutomationCancelled ?? {}),
    [runId]: true,
  };

  return { ok: true };
}

// Chrome serializes only this function for injection, so helpers stay nested.
export async function runTamprBlueprintAutomationNode(
  node: BlueprintAutomationNodeRunInput,
): Promise<BlueprintAutomationNodeRunResponse> {
  if (!document?.documentElement) {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'This page is not ready for automation.',
    };
  }

  if (
    node.type !== 'wait-for-element' &&
    node.type !== 'extract-text' &&
    node.type !== 'extract-list' &&
    node.type !== 'set-value' &&
    node.type !== 'click'
  ) {
    return {
      ok: false,
      reason: 'unsupported',
      message:
        'Manual node runs currently support wait, extract-text, extract-list, confirmed set-value, and confirmed click steps.',
    };
  }

  if (
    (node.type === 'click' || node.type === 'set-value') &&
    !node.confirmAction
  ) {
    return {
      ok: false,
      reason: 'requires-confirmation',
      message: `Manual ${node.type} runs need explicit confirmation.`,
    };
  }

  if (
    (node.type === 'click' || node.type === 'set-value') &&
    node.requireVisible !== true
  ) {
    return {
      ok: false,
      reason: 'unsupported',
      message: `Manual ${node.type} runs require a visible target.`,
    };
  }

  const selector = node.selector.trim();
  const runId = node.runId;

  if (!selector) {
    return {
      ok: false,
      reason: 'invalid-selector',
      message: 'Automation node run needs a selector.',
    };
  }

  const startedAt = Date.now();
  const timeoutMs = clampTimeout(node.timeoutMs);

  try {
    clearCancellation(runId);

    const match = await waitForElement(selector, node, timeoutMs);
    const durationMs = Date.now() - startedAt;

    if (match.cancelled) {
      return {
        ok: false,
        reason: 'cancelled',
        message: 'Automation node run was stopped.',
      };
    }

    if (!match.element) {
      return {
        ok: false,
        reason: 'timeout',
        message: `Automation node timed out waiting for ${selector}.`,
      };
    }

    const element = match.element;
    const base = runResultBase(
      {
        element,
        matches: match.matches,
        visibleMatches: match.visibleMatches,
      },
      node,
      durationMs,
    );

    if (isCancelled(runId)) {
      return {
        ok: false,
        reason: 'cancelled',
        message: 'Automation node run was stopped.',
      };
    }

    if (node.type === 'extract-text') {
      const value = normalizeText(element.textContent ?? '');
      const preview = truncate(value, 160);

      return {
        ok: true,
        result: {
          ...base,
          message: 'Text extracted from the source page.',
          ...(preview ? { preview } : {}),
          value: truncate(value, 2_000),
          ...(node.variableName ? { variableName: node.variableName } : {}),
        },
      };
    }

    if (node.type === 'extract-list') {
      const items = extractListItems(match.matches, match.visibleMatches, node);
      const value = JSON.stringify(items, null, 2);
      const preview = listPreview(items);

      return {
        ok: true,
        result: {
          ...base,
          message: `Extracted ${items.length} list ${
            items.length === 1 ? 'item' : 'items'
          } from the source page.`,
          ...(preview ? { preview } : {}),
          value: truncate(value, 4_000),
          ...(node.variableName ? { variableName: node.variableName } : {}),
        },
      };
    }

    if (node.type === 'click') {
      if (!(element instanceof HTMLElement)) {
        return {
          ok: false,
          reason: 'unsafe-target',
          message: 'Manual click run needs an HTML element target.',
        };
      }

      const target = resolveClickTarget(element);
      const unsafeMessage = unsafeClickMessage(target);

      if (unsafeMessage) {
        return {
          ok: false,
          reason: 'unsafe-target',
          message: unsafeMessage,
        };
      }

      synthesizeClick(target);

      return {
        ok: true,
        result: {
          ...base,
          message: 'Element clicked on the source page.',
          ...previewResult(target),
        },
      };
    }

    if (node.type === 'set-value') {
      const unsafeMessage = unsafeFieldMessage(element);

      if (unsafeMessage) {
        return {
          ok: false,
          reason: 'unsafe-target',
          message: unsafeMessage,
        };
      }

      setFieldValue(element, node.value ?? '');

      return {
        ok: true,
        result: {
          ...base,
          message: 'Value set on the source page.',
          ...previewResult(element),
          value: truncate(node.value ?? '', 2_000),
        },
      };
    }

    return {
      ok: true,
      result: {
        ...base,
        message: 'Element is ready on the source page.',
        ...previewResult(element),
      },
    };
  } catch (error: unknown) {
    if (isSelectorSyntaxError(error)) {
      return {
        ok: false,
        reason: 'invalid-selector',
        message: 'Automation node selector is not valid CSS.',
      };
    }

    throw error;
  }

  function isSelectorSyntaxError(error: unknown): boolean {
    return (
      error instanceof SyntaxError ||
      (error instanceof DOMException && error.name === 'SyntaxError')
    );
  }

  async function waitForElement(
    selectorValue: string,
    runNode: BlueprintAutomationNodeRunInput,
    waitMs: number,
  ): Promise<{
    element?: Element;
    cancelled?: boolean;
    matches: Element[];
    visibleMatches: Element[];
  }> {
    const waitStartedAt = Date.now();

    while (Date.now() - waitStartedAt <= waitMs) {
      if (isCancelled(runNode.runId)) {
        return {
          cancelled: true,
          matches: [],
          visibleMatches: [],
        };
      }

      const matches = Array.from(document.querySelectorAll(selectorValue));
      const visibleMatches = matches.filter(isVisibleElement);
      const element =
        runNode.requireVisible === false ? matches[0] : visibleMatches[0];

      if (element) {
        return {
          element,
          matches,
          visibleMatches,
        };
      }

      await sleep(100);
    }

    const matches = Array.from(document.querySelectorAll(selectorValue));
    const visibleMatches = matches.filter(isVisibleElement);

    return {
      matches,
      visibleMatches,
    };
  }

  function clearCancellation(runIdValue: string | undefined): void {
    if (!runIdValue) {
      return;
    }

    const automationWindow = window as BlueprintAutomationWindow;

    if (automationWindow.__tamprBlueprintAutomationCancelled) {
      delete automationWindow.__tamprBlueprintAutomationCancelled[runIdValue];
    }
  }

  function isCancelled(runIdValue: string | undefined): boolean {
    if (!runIdValue) {
      return false;
    }

    const automationWindow = window as BlueprintAutomationWindow;

    return Boolean(
      automationWindow.__tamprBlueprintAutomationCancelled?.[runIdValue],
    );
  }

  function runResultBase(
    match: {
      element: Element;
      matches: Element[];
      visibleMatches: Element[];
    },
    runNode: BlueprintAutomationNodeRunInput,
    durationMs: number,
  ): BlueprintAutomationNodeRunResultBase {
    return {
      action: runNode.type,
      durationMs,
      firstTagName: match.element.localName.toLowerCase(),
      matchCount: match.matches.length,
      visibleCount: match.visibleMatches.length,
    };
  }

  function previewFor(element: Element): string | undefined {
    const text = normalizeText(element.textContent ?? '');

    return text ? truncate(text, 160) : undefined;
  }

  function extractListItems(
    matches: Element[],
    visibleMatches: Element[],
    runNode: BlueprintAutomationNodeRunInput,
  ): Array<Record<string, string>> {
    const sourceMatches =
      runNode.requireVisible === false ? matches : visibleMatches;

    return sourceMatches
      .slice(0, maxExtractListItems(runNode))
      .map((match) => extractListItem(match, runNode.fields));
  }

  function extractListItem(
    element: Element,
    fields: BlueprintAutomationNodeRunInput['fields'],
  ): Record<string, string> {
    if (!fields?.length) {
      return {
        text: normalizeText(element.textContent ?? ''),
      };
    }

    return Object.fromEntries(
      fields.map((field) => [field.name, extractListField(element, field)]),
    );
  }

  function extractListField(
    element: Element,
    field: NonNullable<BlueprintAutomationNodeRunInput['fields']>[number],
  ): string {
    const target =
      field.selector === ':scope'
        ? element
        : element.querySelector(field.selector);

    if (!target) {
      return '';
    }

    if (field.source === 'attribute') {
      return target.getAttribute(field.attribute ?? '') ?? '';
    }

    return normalizeText(target.textContent ?? '');
  }

  function listPreview(
    items: Array<Record<string, string>>,
  ): string | undefined {
    const preview = items
      .map(formatListPreviewItem)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');

    return preview || undefined;
  }

  function formatListPreviewItem(item: Record<string, string>): string {
    if ('text' in item && Object.keys(item).length === 1) {
      return `"${truncate(item.text ?? '', 50)}"`;
    }

    return Object.entries(item)
      .map(([key, value]) => `${key}: "${truncate(value, 32)}"`)
      .join(', ');
  }

  function previewResult(element: Element): { preview: string } | object {
    const preview = previewFor(element);

    return preview ? { preview } : {};
  }

  function resolveClickTarget(element: HTMLElement): HTMLElement {
    const interactive = element.closest(
      'button, a[href], [role="button"], [role="link"], summary, label, input[type="button"], input[type="submit"], input[type="reset"]',
    );

    return interactive instanceof HTMLElement ? interactive : element;
  }

  function synthesizeClick(element: HTMLElement): void {
    const init: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
    };
    const pointerInit: PointerEventInit = {
      ...init,
      pointerType: 'mouse',
      isPrimary: true,
    };
    const pointerSequence: Array<
      ['pointerdown' | 'pointerup', 'mousedown' | 'mouseup']
    > = [
      ['pointerdown', 'mousedown'],
      ['pointerup', 'mouseup'],
    ];

    for (const [pointerType, mouseType] of pointerSequence) {
      if (typeof PointerEvent === 'function') {
        const pointerEvent = createPointerEvent(pointerType, pointerInit);

        if (pointerEvent) {
          element.dispatchEvent(pointerEvent);
        }
      }

      element.dispatchEvent(new MouseEvent(mouseType, init));
    }

    element.click();
  }

  function createPointerEvent(
    type: 'pointerdown' | 'pointerup',
    init: PointerEventInit,
  ): PointerEvent | undefined {
    try {
      return new PointerEvent(type, init);
    } catch {
      return undefined;
    }
  }

  function unsafeClickMessage(element: Element): string | undefined {
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

    return riskyWords.some((word) => copy.includes(word))
      ? 'Manual click run refused a risky target.'
      : undefined;
  }

  function unsafeFieldMessage(element: Element): string | undefined {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      )
    ) {
      return 'Manual set-value run needs a supported form field target.';
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
        return 'Manual set-value run refused a protected field.';
      }
    }

    const copy = [
      element.getAttribute('autocomplete'),
      element.getAttribute('aria-label'),
      element.getAttribute('id'),
      element.getAttribute('name'),
      element.getAttribute('placeholder'),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const protectedWords = [
      'card',
      'cvv',
      'one-time',
      'otp',
      'passcode',
      'password',
      'payment',
    ];

    return protectedWords.some((word) => copy.includes(word))
      ? 'Manual set-value run refused a sensitive field.'
      : undefined;
  }

  function setFieldValue(element: Element, value: string): void {
    const field = element as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement;

    field.focus();
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function normalizeText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  function isVisibleElement(element: Element): boolean {
    let current: Element | null = element;

    while (current) {
      if (current.hasAttribute('hidden')) {
        return false;
      }

      const style = window.getComputedStyle(current);

      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        style.opacity === '0'
      ) {
        return false;
      }

      current = current.parentElement;
    }

    const rect = element.getBoundingClientRect();

    return rect.width > 0 && rect.height > 0;
  }

  function clampTimeout(value: number | undefined): number {
    if (value === undefined || !Number.isFinite(value)) {
      return 5_000;
    }

    return Math.min(Math.max(Math.trunc(value), 250), 60_000);
  }

  function maxExtractListItems(runNode: BlueprintAutomationNodeRunInput) {
    const maxItems = runNode.maxItems;

    if (maxItems === undefined || !Number.isFinite(maxItems)) {
      return 50;
    }

    return Math.min(500, Math.max(1, Math.trunc(maxItems)));
  }

  function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return value.slice(0, maxLength - 1).trimEnd();
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}
