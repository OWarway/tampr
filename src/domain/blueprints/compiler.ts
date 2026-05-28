import type { BlueprintNode, BlueprintRecipe } from './recipe';
import { getLinearBlueprintNodes } from './recipe';

export function compileBlueprintCss(recipe: BlueprintRecipe): string {
  return getLinearBlueprintNodes(recipe)
    .filter((node) => node.enabled)
    .map(compileCssNode)
    .filter(Boolean)
    .join('\n\n');
}

export function isBlueprintCssInSync(
  recipe: BlueprintRecipe,
  css: string,
): boolean {
  return normalizeCss(css) === normalizeCss(compileBlueprintCss(recipe));
}

function compileCssNode(node: BlueprintNode): string {
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

function normalizeCss(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}
