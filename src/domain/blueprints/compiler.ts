import { isBlueprintAutomationAction, isBlueprintCssAction } from './actions';
import type {
  BlueprintAutomationNode,
  BlueprintCssNode,
  BlueprintRecipe,
} from './recipe';
import { getLinearBlueprintNodes } from './recipe';

export function compileBlueprintCss(recipe: BlueprintRecipe): string {
  return getLinearBlueprintNodes(recipe)
    .filter((node) => node.enabled)
    .filter((node): node is BlueprintCssNode => isBlueprintCssAction(node.type))
    .map(compileCssNode)
    .join('\n\n');
}

export function compileBlueprintJavaScript(recipe: BlueprintRecipe): string {
  const steps = getLinearBlueprintNodes(recipe)
    .filter((node) => node.enabled)
    .filter((node): node is BlueprintAutomationNode =>
      isBlueprintAutomationAction(node.type),
    )
    .map(automationStepDefinition);

  if (steps.length === 0) {
    return '';
  }

  return `(() => {
  const PREFIX = '[Tampr Blueprint]';
  const steps = ${JSON.stringify(steps, null, 2)};
  const values = {};

  void runBlueprint().catch((error) => {
    console.error(PREFIX, error);
  });

  async function runBlueprint() {
    for (const step of steps) {
      console.debug(PREFIX, 'Running step', step.label);

      if (step.type === 'wait-for-element') {
        await waitForElement(step);
        continue;
      }

      if (step.type === 'click') {
        const element = await waitForElement(step);
        assertSafeClickTarget(element, step);
        element.click();
        continue;
      }

      if (step.type === 'set-value') {
        const element = await waitForElement(step);
        setFieldValue(element, step.value, step);
        continue;
      }

      if (step.type === 'extract-text') {
        const element = await waitForElement(step);
        values[step.variableName] = (element.textContent ?? '').replace(/\\s+/g, ' ').trim();
        continue;
      }

      if (step.type === 'download-json') {
        await downloadJson(step);
      }
    }
  }

  async function waitForElement(step) {
    const startedAt = Date.now();

    while (Date.now() - startedAt <= step.timeoutMs) {
      const element = document.querySelector(step.selector);

      if (element && (!step.requireVisible || isVisible(element))) {
        return element;
      }

      await sleep(100);
    }

    throw new Error(\`Step "\${step.label}" timed out waiting for \${step.selector}.\`);
  }

  function isVisible(element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.visibility !== 'collapse' &&
      Number(style.opacity) !== 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function assertSafeClickTarget(element, step) {
    const text = [
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

    if (riskyWords.some((word) => text.includes(word))) {
      throw new Error(\`Step "\${step.label}" needs manual review before clicking a risky control.\`);
    }
  }

  function setFieldValue(element, value, step) {
    assertSafeField(element, step);
    element.focus();

    if (element instanceof HTMLSelectElement) {
      element.value = value;
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function assertSafeField(element, step) {
    const supported =
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement;

    if (!supported) {
      throw new Error(\`Step "\${step.label}" can only set values on form fields.\`);
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
        throw new Error(\`Step "\${step.label}" refused to set a protected input field.\`);
      }
    }

    const fieldCopy = [
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

    if (protectedWords.some((word) => fieldCopy.includes(word))) {
      throw new Error(\`Step "\${step.label}" refused to set a sensitive field.\`);
    }
  }

  async function downloadJson(step) {
    const value = step.valueFrom ? values[step.valueFrom] : values;

    if (!globalThis.Tampr?.download) {
      throw new Error('Tampr.download is not available in this script world.');
    }

    await globalThis.Tampr.download({
      filename: step.filename,
      mimeType: 'application/json;charset=utf-8',
      text: JSON.stringify(value, null, 2),
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
})();`;
}

export function isBlueprintCssInSync(
  recipe: BlueprintRecipe,
  css: string,
): boolean {
  return normalizeCss(css) === normalizeCss(compileBlueprintCss(recipe));
}

export function isBlueprintJavaScriptInSync(
  recipe: BlueprintRecipe,
  js: string,
): boolean {
  return normalizeCss(js) === normalizeCss(compileBlueprintJavaScript(recipe));
}

function compileCssNode(node: BlueprintCssNode): string {
  switch (node.type) {
    case 'hide':
      return `${node.selector} {
  display: none !important;
}`;
    case 'highlight':
      return `${node.selector} {
  outline: 3px solid #d44d3a !important;
  outline-offset: 3px !important;
}`;
    case 'remove-overlay':
      return `${node.selector} {
  display: none !important;
  pointer-events: none !important;
}

html,
body {
  overflow: auto !important;
}`;
    case 'sticky':
      return `${node.selector} {
  position: sticky !important;
  top: 0 !important;
  z-index: 2147483646 !important;
}`;
    case 'widen':
      return `${node.selector} {
  max-width: none !important;
  width: min(100%, 1200px) !important;
}`;
    case 'print-cleanup':
      return `@media print {
  ${node.selector} {
    display: none !important;
  }
}`;
  }

  const exhaustive: never = node.type;
  return exhaustive;
}

function automationStepDefinition(node: BlueprintAutomationNode) {
  const base = {
    id: node.id,
    label: node.label ?? node.type,
    selector: node.selector,
    type: node.type,
  };

  switch (node.type) {
    case 'wait-for-element':
    case 'click':
      return {
        ...base,
        requireVisible: node.requireVisible,
        timeoutMs: node.timeoutMs,
      };
    case 'set-value':
      return {
        ...base,
        requireVisible: node.requireVisible,
        timeoutMs: node.timeoutMs,
        value: node.value,
      };
    case 'extract-text':
      return {
        ...base,
        requireVisible: node.requireVisible,
        timeoutMs: node.timeoutMs,
        variableName: node.variableName,
      };
    case 'download-json':
      return {
        ...base,
        filename: node.filename,
        ...(node.valueFrom ? { valueFrom: node.valueFrom } : {}),
        requireVisible: false,
        timeoutMs: 0,
      };
  }

  const exhaustive: never = node;
  return exhaustive;
}

function normalizeCss(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}
