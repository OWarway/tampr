import {
  SnippetDraftSchema,
  type Snippet,
  type SnippetDraft,
} from '../domain/snippets';
import type { WorkspaceState } from '../shared/workspace-messages';

export type EditorState = {
  id?: string;
  name: string;
  enabled: boolean;
  matches: string;
  excludeMatches: string;
  css: string;
  js: string;
  runAt: Snippet['runAt'];
  world: Snippet['world'];
};

export const newSnippetEditor: EditorState = {
  name: 'Example highlight',
  enabled: true,
  matches: '*://example.com/*',
  excludeMatches: '',
  css: `body {
  outline: 4px solid #d44d3a;
  outline-offset: -4px;
}`,
  js: `document.documentElement.dataset.tampr = 'active';`,
  runAt: 'document_idle',
  world: 'USER_SCRIPT',
};

export type EditorDraftResult =
  | {
      ok: true;
      draft: SnippetDraft;
    }
  | {
      ok: false;
      message: string;
    };

export function parseEditorDraft(value: EditorState): EditorDraftResult {
  const result = SnippetDraftSchema.safeParse({
    ...value,
    matches: toPatternLines(value.matches),
    excludeMatches: toPatternLines(value.excludeMatches),
  });

  if (!result.success) {
    return {
      ok: false,
      message: result.error.issues[0]?.message ?? 'Snippet is invalid.',
    };
  }

  return {
    ok: true,
    draft: result.data,
  };
}

export function toEditorState(snippet: Snippet): EditorState {
  return {
    id: snippet.id,
    name: snippet.name,
    enabled: snippet.enabled,
    matches: snippet.matches.join('\n'),
    excludeMatches: snippet.excludeMatches.join('\n'),
    css: snippet.css,
    js: snippet.js,
    runAt: snippet.runAt,
    world: snippet.world,
  };
}

export function duplicateEditor(value: EditorState): EditorState {
  return {
    css: value.css,
    enabled: value.enabled,
    excludeMatches: value.excludeMatches,
    js: value.js,
    matches: value.matches,
    name: duplicateName(value.name),
    runAt: value.runAt,
    world: value.world,
  };
}

export function hasUnsavedChanges(
  value: EditorState,
  snippets: readonly Snippet[],
): boolean {
  if (!value.id) {
    return true;
  }

  const snippet = snippets.find((candidate) => candidate.id === value.id);

  return !snippet || !editorsEqual(value, toEditorState(snippet));
}

export function findSavedSnippet(
  workspace: WorkspaceState,
  savedId: string | undefined,
): Snippet | undefined {
  if (savedId) {
    return workspace.snippets.find((snippet) => snippet.id === savedId);
  }

  return workspace.snippets.reduce<Snippet | undefined>((latest, snippet) => {
    return !latest || snippet.updatedAt > latest.updatedAt ? snippet : latest;
  }, undefined);
}

function toPatternLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function duplicateName(value: string): string {
  const suffix = ' copy';
  const base = value.trim() || 'Untitled snippet';

  return `${base.slice(0, 120 - suffix.length).trimEnd()}${suffix}`;
}

function editorsEqual(left: EditorState, right: EditorState): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.enabled === right.enabled &&
    left.matches === right.matches &&
    left.excludeMatches === right.excludeMatches &&
    left.css === right.css &&
    left.js === right.js &&
    left.runAt === right.runAt &&
    left.world === right.world
  );
}
