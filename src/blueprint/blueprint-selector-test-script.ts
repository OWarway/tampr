import type {
  BlueprintSelectorSuggestion,
  BlueprintSelectorTestResult,
} from '../shared/blueprint-messages';

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
    const suggestions = selectorRepairSuggestions(selectorText, matches);
    const recommendation = selectorRecommendation(matches, suggestions);

    return {
      ok: true,
      result: {
        ...(firstTagName ? { firstTagName } : {}),
        ...(recommendation ? { recommendation } : {}),
        ...(suggestions.length > 0 ? { suggestions } : {}),
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

  function selectorRepairSuggestions(
    originalSelector: string,
    matches: Element[],
  ): BlueprintSelectorSuggestion[] {
    if (matches.length <= 1) {
      return [];
    }

    const suggestions: BlueprintSelectorSuggestion[] = [];
    const seenSelectors = new Set([originalSelector]);

    for (const element of matches.filter(isVisibleElement).slice(0, 6)) {
      const suggestion = candidateSuggestions(element).find(
        (candidate) => !seenSelectors.has(candidate.selector),
      );

      if (!suggestion) {
        continue;
      }

      suggestions.push(suggestion);
      seenSelectors.add(suggestion.selector);

      if (suggestions.length >= 3) {
        break;
      }
    }

    return suggestions;
  }

  function candidateSuggestions(
    element: Element,
  ): BlueprintSelectorSuggestion[] {
    const candidates: BlueprintSelectorSuggestion[] = [];
    const tagName = element.localName.toLowerCase();
    const id = element.id.trim();

    if (id) {
      pushUniqueCandidate(
        candidates,
        `#${escapeIdentifier(id)}`,
        'Unique ID on the matched element.',
        1,
        'id',
        false,
      );
    }

    for (const attributeName of [
      'data-testid',
      'data-test',
      'data-cy',
      'data-qa',
      'aria-label',
      'name',
      'title',
    ]) {
      const value = element.getAttribute(attributeName)?.trim();

      if (!value || value.length > 80) {
        continue;
      }

      pushUniqueCandidate(
        candidates,
        `${tagName}[${attributeName}="${escapeAttributeValue(value)}"]`,
        `Unique ${attributeName} marker on the matched element.`,
        1,
        'attribute',
        false,
      );
    }

    const classNames = Array.from(element.classList).filter(isStableClassName);

    for (let size = 1; size <= Math.min(3, classNames.length); size += 1) {
      pushUniqueCandidate(
        candidates,
        `${tagName}${classNames
          .slice(0, size)
          .map((className) => `.${escapeIdentifier(className)}`)
          .join('')}`,
        'Unique class combination on the matched element.',
        1,
        'class',
        false,
      );
    }

    const pathCandidate = pathSelector(element);

    if (pathCandidate) {
      pushUniqueCandidate(
        candidates,
        pathCandidate.selector,
        'Unique page path. Use this only when stable markers are unavailable.',
        pathCandidate.segmentCount,
        pathCandidate.usesNthOfType ? 'position' : 'path',
        pathCandidate.usesNthOfType,
      );
    }

    return candidates;
  }

  function pushUniqueCandidate(
    candidates: BlueprintSelectorSuggestion[],
    selector: string,
    reason: string,
    segmentCount: number,
    strategy: BlueprintSelectorSuggestion['selectorMeta']['strategy'],
    usesNthOfType: boolean,
  ): void {
    const matches = query(selector);

    if (matches.length !== 1) {
      return;
    }

    if (candidates.some((candidate) => candidate.selector === selector)) {
      return;
    }

    candidates.push({
      matchCount: matches.length,
      reason,
      selector,
      selectorMeta: {
        matchCount: matches.length,
        segmentCount,
        strategy,
        usesNthOfType,
      },
      visibleCount: matches.filter(isVisibleElement).length,
    });
  }

  function selectorRecommendation(
    matches: Element[],
    suggestions: BlueprintSelectorSuggestion[],
  ): string | undefined {
    if (matches.length === 0) {
      return 'Selector does not match this page anymore. Pick the element again from the source page.';
    }

    if (matches.length > 1 && suggestions.length > 0) {
      return 'Selector matches multiple elements. Use a unique repair suggestion or pick the exact element again.';
    }

    if (matches.length > 1) {
      return 'Selector matches multiple elements. Pick the exact element again to make this safer.';
    }

    if (matches.filter(isVisibleElement).length === 0) {
      return 'Selector matches only hidden elements. Pick a visible target before running automation.';
    }

    return undefined;
  }

  function pathSelector(
    element: Element,
  ): { selector: string; segmentCount: number; usesNthOfType: boolean } | null {
    const segments: string[] = [];
    let current: Element | null = element;
    let usesNthOfType = false;

    while (
      current &&
      current !== document.documentElement &&
      current !== document.body &&
      segments.length < 5
    ) {
      const localName = current.localName;
      let segment = localName.toLowerCase();
      const parent: Element | null = current.parentElement;

      if (parent) {
        const sameTagSiblings = (
          Array.from(parent.children) as Element[]
        ).filter((sibling) => sibling.localName === localName);

        if (sameTagSiblings.length > 1) {
          segment = `${segment}:nth-of-type(${
            sameTagSiblings.indexOf(current) + 1
          })`;
          usesNthOfType = true;
        }
      }

      segments.unshift(segment);

      const selector = segments.join(' > ');

      if (query(selector).length === 1) {
        return {
          selector,
          segmentCount: segments.length,
          usesNthOfType,
        };
      }

      current = parent;
    }

    return null;
  }

  function query(selectorText: string): Element[] {
    try {
      return Array.from(document.querySelectorAll(selectorText));
    } catch {
      return [];
    }
  }

  function isStableClassName(className: string): boolean {
    return (
      /^[A-Za-z0-9_-]{2,64}$/.test(className) &&
      !/^(active|checked|current|disabled|enabled|focus|hidden|open|selected|visible)$/i.test(
        className,
      ) &&
      !/^[a-f0-9]{8,}$/i.test(className)
    );
  }

  function escapeAttributeValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\a ');
  }

  function escapeIdentifier(value: string): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }

    return value.replace(/[^A-Za-z0-9_-]/g, (character) => `\\${character}`);
  }
}
