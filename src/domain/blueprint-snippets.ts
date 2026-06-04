import { buildPageRulePresets } from './page-rule-presets';
import { SnippetDraftSchema, type SnippetDraft } from './snippets';
import type { BlueprintSelectorMeta } from './blueprint-selectors';
import {
  BLUEPRINT_CSS_ACTIONS,
  blueprintActionLabel,
  blueprintNodeLabel,
  type BlueprintNodeAction,
  type BlueprintCssAction,
} from './blueprints/actions';
import {
  BLUEPRINT_RECIPE_VERSION,
  BlueprintRecipeSchema,
  buildCssBlueprintRecipe,
  type BlueprintExtractListField,
  type BlueprintRecipe,
} from './blueprints/recipe';
import {
  compileBlueprintCss,
  compileBlueprintJavaScript,
} from './blueprints/compiler';

export const BLUEPRINT_SNIPPET_FOLDER = 'Blueprints';
export const BLUEPRINT_ACTIONS = BLUEPRINT_CSS_ACTIONS;

export type BlueprintAction = BlueprintCssAction;

export type BlueprintElementPick = {
  label: string;
  selector: string;
  selectorMeta: BlueprintSelectorMeta;
  tagName: string;
  text?: string;
};

export type BuildBlueprintSnippetDraftInput = {
  action: BlueprintAction;
  pageUrl: string;
  pick: BlueprintElementPick;
};

export type BlueprintFlowDraftNode = {
  action: BlueprintNodeAction;
  code?: string;
  fields?: BlueprintExtractListField[];
  label?: string;
  maxItems?: number;
  pick: BlueprintElementPick;
  reviewed?: boolean;
  value?: string;
  variableName?: string;
};

export type BuildBlueprintFlowSnippetDraftInput = {
  nodes: readonly BlueprintFlowDraftNode[];
  pageUrl: string;
};

export function buildBlueprintSnippetDraft({
  action,
  pageUrl,
  pick,
}: BuildBlueprintSnippetDraftInput): SnippetDraft {
  const name = `${actionLabel(action)} ${snippetSubject(pick)}`;
  const recipe = buildCssBlueprintRecipe({
    id: `${action}-selection`,
    label: name,
    selector: pick.selector,
    selectorMeta: pick.selectorMeta,
    type: action,
  });

  return SnippetDraftSchema.parse({
    name,
    folder: BLUEPRINT_SNIPPET_FOLDER,
    enabled: true,
    matches: [blueprintMatchRule(pageUrl)],
    excludeMatches: [],
    css: compileBlueprintCss(recipe),
    js: '',
    runAt: 'document_idle',
    world: 'USER_SCRIPT',
    blueprint: recipe,
  });
}

export function buildBlueprintFlowSnippetDraft({
  nodes,
  pageUrl,
}: BuildBlueprintFlowSnippetDraftInput): SnippetDraft {
  if (nodes.length === 0) {
    throw new Error('Blueprint flow needs at least one node.');
  }

  const recipe = buildBlueprintFlowRecipe(nodes);
  const name = recipe.name;

  return SnippetDraftSchema.parse({
    name,
    folder: BLUEPRINT_SNIPPET_FOLDER,
    enabled: true,
    matches: [blueprintMatchRule(pageUrl)],
    excludeMatches: [],
    css: compileBlueprintCss(recipe),
    js: compileBlueprintJavaScript(recipe),
    runAt: 'document_idle',
    world: 'USER_SCRIPT',
    blueprint: recipe,
  });
}

function actionLabel(action: BlueprintAction): string {
  return blueprintActionLabel(action);
}

function buildBlueprintFlowRecipe(
  nodes: readonly BlueprintFlowDraftNode[],
): BlueprintRecipe {
  const recipeNodes = nodes.map((node, index) => {
    const id = `${node.action}-step-${index + 1}`;
    const label =
      node.label?.trim() ||
      `${blueprintNodeLabel(node.action)} ${snippetSubject(node.pick)}`;
    const base = {
      enabled: true,
      id,
      label,
      selector: node.pick.selector,
      selectorMeta: node.pick.selectorMeta,
      type: node.action,
    };

    switch (node.action) {
      case 'set-value':
        return {
          ...base,
          value: node.value ?? '',
        };
      case 'extract-text':
        return {
          ...base,
          variableName: node.variableName ?? `value${index + 1}`,
        };
      case 'extract-list':
        return {
          ...base,
          fields: node.fields ?? [],
          maxItems: node.maxItems ?? 50,
          variableName: node.variableName ?? `items${index + 1}`,
        };
      case 'custom-code':
        return {
          ...base,
          code:
            node.code ??
            [
              '// element is the selected page element.',
              '// values stores extracted Blueprint values.',
            ].join('\n'),
          reviewed: node.reviewed ?? false,
        };
      default:
        return base;
    }
  });

  return BlueprintRecipeSchema.parse({
    version: BLUEPRINT_RECIPE_VERSION,
    name: flowName(nodes),
    graph: {
      nodes: recipeNodes,
      edges: recipeNodes.slice(1).map((node, index) => ({
        id: `edge-${node.id}`,
        fromNodeId: recipeNodes[index]?.id,
        fromPort: 'success',
        toNodeId: node.id,
      })),
      layout: Object.fromEntries(
        recipeNodes.map((node, index) => [node.id, { x: index * 220, y: 0 }]),
      ),
    },
  });
}

function flowName(nodes: readonly BlueprintFlowDraftNode[]): string {
  const firstNode = nodes[0];

  if (!firstNode) {
    return 'Blueprint flow';
  }

  const subject = snippetSubject(firstNode.pick);
  const suffix = nodes.length === 1 ? '' : ` + ${nodes.length - 1} steps`;

  return `${blueprintNodeLabel(firstNode.action)} ${subject}${suffix}`.slice(
    0,
    120,
  );
}

function snippetSubject(pick: BlueprintElementPick): string {
  const subject = pick.label || pick.text || pick.tagName || 'selected element';
  return subject.slice(0, 80).trim() || 'selected element';
}

function blueprintMatchRule(pageUrl: string): string {
  const presets = buildPageRulePresets(pageUrl);
  const pathPreset = presets.find((preset) => preset.id === 'path');
  const pagePreset = presets.find((preset) => preset.id === 'page');
  const sitePreset = presets.find((preset) => preset.id === 'site');
  const pattern =
    pathPreset?.pattern ?? pagePreset?.pattern ?? sitePreset?.pattern;

  if (!pattern) {
    throw new Error('Blueprints need an http or https page.');
  }

  return pattern;
}
