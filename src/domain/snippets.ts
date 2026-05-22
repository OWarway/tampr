export const SNIPPET_RUN_TIMINGS = ['document_start', 'document_idle'] as const;
export const SNIPPET_WORLDS = ['USER_SCRIPT', 'MAIN'] as const;

export type SnippetRunTiming = (typeof SNIPPET_RUN_TIMINGS)[number];
export type SnippetWorld = (typeof SNIPPET_WORLDS)[number];

export type Snippet = {
  id: string;
  name: string;
  enabled: boolean;
  matches: string[];
  excludeMatches: string[];
  css: string;
  js: string;
  runAt: SnippetRunTiming;
  world: SnippetWorld;
  createdAt: number;
  updatedAt: number;
};

type EmptySnippetInput = {
  id: string;
  now: number;
  name?: string;
};

export function createEmptySnippet({
  id,
  name = 'Untitled snippet',
  now,
}: EmptySnippetInput): Snippet {
  return {
    id,
    name,
    enabled: true,
    matches: [],
    excludeMatches: [],
    css: '',
    js: '',
    runAt: 'document_idle',
    world: 'USER_SCRIPT',
    createdAt: now,
    updatedAt: now,
  };
}
