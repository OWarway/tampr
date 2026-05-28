import type { BlueprintSelectorTestResult } from '../shared/blueprint-messages';

export type BlueprintSelectorTestResponse =
  | {
      ok: true;
      result: BlueprintSelectorTestResult;
    }
  | {
      message: string;
      ok: false;
      reason: 'invalid-selector' | 'unavailable';
    };

type BlueprintSelectorTestInput = {
  selector: string;
};

// Chrome serializes only this function for injection, so helpers stay nested.
export function runTamprBlueprintSelectorTest({
  selector,
}: BlueprintSelectorTestInput): BlueprintSelectorTestResponse {
  const selectorText = selector.trim();

  if (!selectorText) {
    return {
      ok: false,
      reason: 'invalid-selector',
      message: 'Blueprint selector test needs a selector.',
    };
  }

  if (!document?.documentElement) {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'This page is not ready for selector testing.',
    };
  }

  try {
    const matches = Array.from(document.querySelectorAll(selectorText));
    const firstTagName = matches[0]?.localName.toLowerCase();

    return {
      ok: true,
      result: {
        ...(firstTagName ? { firstTagName } : {}),
        matchCount: matches.length,
        visibleCount: matches.filter(isVisibleElement).length,
      },
    };
  } catch {
    return {
      ok: false,
      reason: 'invalid-selector',
      message: 'Blueprint selector is not valid CSS.',
    };
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
}
