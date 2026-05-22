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
