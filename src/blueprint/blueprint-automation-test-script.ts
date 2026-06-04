import type { BlueprintAutomationAction } from '../domain/blueprints/actions';
import type { BlueprintExtractListField } from '../domain/blueprints/recipe';
import type { BlueprintAutomationNodeTestResult } from '../shared/blueprint-messages';

export type BlueprintAutomationNodeTestInput = {
  fields?: BlueprintExtractListField[];
  filename?: string;
  maxItems?: number;
  requireVisible?: boolean;
  selector: string;
  type: BlueprintAutomationAction;
  value?: string;
  valueFrom?: string;
  variableName?: string;
};

export type BlueprintAutomationNodeTestResponse =
  | {
      ok: true;
      result: BlueprintAutomationNodeTestResult;
    }
  | {
      message: string;
      ok: false;
      reason: 'invalid-selector' | 'unavailable';
    };

// Chrome serializes only this function for injection, so helpers stay nested.
export function runTamprBlueprintAutomationNodeTest(
  node: BlueprintAutomationNodeTestInput,
): BlueprintAutomationNodeTestResponse {
  if (!document?.documentElement) {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'This page is not ready for automation testing.',
    };
  }

  if (node.type === 'download-json') {
    return {
      ok: true,
      result: testDownloadNode(node),
    };
  }

  const selector = node.selector.trim();

  if (!selector) {
    return {
      ok: false,
      reason: 'invalid-selector',
      message: 'Automation node test needs a selector.',
    };
  }

  try {
    const matches = Array.from(document.querySelectorAll(selector));
    const visibleMatches = matches.filter(isVisibleElement);
    const firstElement = matches[0];
    const issues: string[] = [];

    addMatchIssues(matches, visibleMatches, node, issues);
    addActionIssues(firstElement, node, issues);

    const preview = previewFor(firstElement, node);

    return {
      ok: true,
      result: {
        action: node.type,
        ...(firstElement
          ? { firstTagName: firstElement.localName.toLowerCase() }
          : {}),
        issues,
        matchCount: matches.length,
        ...(preview ? { preview } : {}),
        ready: issues.length === 0,
        visibleCount: visibleMatches.length,
      },
    };
  } catch {
    return {
      ok: false,
      reason: 'invalid-selector',
      message: 'Automation node selector is not valid CSS.',
    };
  }

  function testDownloadNode(
    downloadNode: BlueprintAutomationNodeTestInput,
  ): BlueprintAutomationNodeTestResult {
    const filename = downloadNode.filename?.trim() ?? '';
    const issues: string[] = [];

    if (!filename) {
      issues.push('Download filename is empty.');
    } else if (!filename.toLowerCase().endsWith('.json')) {
      issues.push('Download filename should end with .json.');
    }

    return {
      action: downloadNode.type,
      issues,
      matchCount: 0,
      preview: downloadNode.valueFrom
        ? `Downloads value from ${downloadNode.valueFrom}.`
        : 'Downloads all collected values.',
      ready: issues.length === 0,
      visibleCount: 0,
    };
  }

  function addMatchIssues(
    matches: Element[],
    visibleMatches: Element[],
    testNode: BlueprintAutomationNodeTestInput,
    issues: string[],
  ): void {
    if (matches.length === 0) {
      issues.push('Selector does not match anything on this page.');
      return;
    }

    if (matches.length > 1) {
      if (testNode.type !== 'extract-list') {
        issues.push(
          `Selector matches ${matches.length} elements on this page.`,
        );
      }
    }

    if (
      testNode.type === 'extract-list' &&
      matches.length > maxExtractListItems(testNode)
    ) {
      issues.push(
        `Selector matches ${matches.length} elements; only the first ${maxExtractListItems(
          testNode,
        )} will be extracted.`,
      );
    }

    if (testNode.requireVisible !== false && visibleMatches.length === 0) {
      issues.push('No matching elements are visible.');
    }
  }

  function addActionIssues(
    element: Element | undefined,
    testNode: BlueprintAutomationNodeTestInput,
    issues: string[],
  ): void {
    if (!element) {
      return;
    }

    if (testNode.type === 'click' && riskyClickCopy(element)) {
      issues.push('Click target looks risky and needs manual review.');
      return;
    }

    if (testNode.type !== 'set-value') {
      return;
    }

    if (!supportedField(element)) {
      issues.push('Target is not a supported form field.');
    }

    if (protectedField(element)) {
      issues.push('Target looks like a protected or sensitive field.');
    }

    if (!testNode.value?.trim()) {
      issues.push('Set-value node has no value yet.');
    }
  }

  function previewFor(
    element: Element | undefined,
    testNode: BlueprintAutomationNodeTestInput,
  ): string | undefined {
    if (!element) {
      return undefined;
    }

    if (testNode.type === 'set-value') {
      return fieldPreview(element);
    }

    if (testNode.type === 'extract-list') {
      const selector = testNode.selector.trim();
      const matches = Array.from(document.querySelectorAll(selector));
      const usableMatches =
        testNode.requireVisible === false
          ? matches
          : matches.filter(isVisibleElement);
      const items = usableMatches
        .slice(0, Math.min(3, maxExtractListItems(testNode)))
        .map((match) => extractListItem(match, testNode.fields));

      return items.length > 0
        ? `First rows: ${items.map(formatListPreviewItem).join(', ')}`
        : undefined;
    }

    const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();

    return text ? truncate(text, 120) : undefined;
  }

  function fieldPreview(element: Element): string | undefined {
    if (element instanceof HTMLInputElement) {
      return `${element.type || 'text'} input`;
    }

    if (element instanceof HTMLTextAreaElement) {
      return 'textarea';
    }

    if (element instanceof HTMLSelectElement) {
      return 'select';
    }

    return undefined;
  }

  function supportedField(element: Element): boolean {
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    );
  }

  function protectedField(element: Element): boolean {
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
        return true;
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

    return [
      'card',
      'cvv',
      'one-time',
      'otp',
      'passcode',
      'password',
      'payment',
    ].some((word) => copy.includes(word));
  }

  function riskyClickCopy(element: Element): boolean {
    const copy = [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.textContent,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return [
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
    ].some((word) => copy.includes(word));
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

  function maxExtractListItems(testNode: BlueprintAutomationNodeTestInput) {
    const maxItems = testNode.maxItems;

    if (maxItems === undefined || !Number.isFinite(maxItems)) {
      return 50;
    }

    return Math.min(500, Math.max(1, Math.trunc(maxItems)));
  }

  function extractListItem(
    element: Element,
    fields: readonly BlueprintExtractListField[] | undefined,
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
    field: BlueprintExtractListField,
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

  function formatListPreviewItem(item: Record<string, string>): string {
    if ('text' in item && Object.keys(item).length === 1) {
      return `"${truncate(item.text ?? '', 40)}"`;
    }

    return Object.entries(item)
      .map(([key, value]) => `${key}: "${truncate(value, 28)}"`)
      .join(', ');
  }

  function normalizeText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return value.slice(0, maxLength - 1).trimEnd();
  }
}
