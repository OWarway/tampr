import { buildPageRulePresets } from './page-rule-presets';
import { SnippetDraftSchema, type SnippetDraft } from './snippets';

export const BLUEPRINT_SNIPPET_FOLDER = 'Blueprints';
export const BLUEPRINT_ACTIONS = ['hide', 'highlight'] as const;

export type BlueprintAction = (typeof BLUEPRINT_ACTIONS)[number];

export type BlueprintElementPick = {
  label: string;
  selector: string;
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
  return SnippetDraftSchema.parse({
    name: `${actionLabel(action)} ${snippetSubject(pick)}`,
    folder: BLUEPRINT_SNIPPET_FOLDER,
    enabled: true,
    matches: [blueprintMatchRule(pageUrl)],
    excludeMatches: [],
    css: blueprintCss(action, pick.selector),
    js: '',
    runAt: 'document_idle',
    world: 'USER_SCRIPT',
  });
}

function actionLabel(action: BlueprintAction): string {
  return action === 'hide' ? 'Hide' : 'Highlight';
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

function blueprintCss(action: BlueprintAction, selector: string): string {
  if (action === 'hide') {
    return `${selector} {
  display: none !important;
}`;
  }

  return `${selector} {
  outline: 3px solid #d44d3a !important;
  outline-offset: 3px !important;
}`;
}
