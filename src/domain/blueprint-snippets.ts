import { buildPageRulePresets } from './page-rule-presets';
import { SnippetDraftSchema, type SnippetDraft } from './snippets';
import type { BlueprintSelectorMeta } from './blueprint-selectors';
import {
  BLUEPRINT_CSS_ACTIONS,
  blueprintActionLabel,
  type BlueprintCssAction,
} from './blueprints/actions';
import { buildCssBlueprintRecipe } from './blueprints/recipe';
import { compileBlueprintCss } from './blueprints/compiler';

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

function actionLabel(action: BlueprintAction): string {
  return blueprintActionLabel(action);
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
