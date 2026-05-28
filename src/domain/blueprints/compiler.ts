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
  if (node.type === 'hide') {
    return `${node.selector} {
  display: none !important;
}`;
  }

  return `${node.selector} {
  outline: 3px solid #d44d3a !important;
  outline-offset: 3px !important;
}`;
}

function normalizeCss(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}
