import { z } from 'zod';

import { SnippetSchema } from '../domain/snippets';

export const SNIPPET_STORAGE_KEY = 'tampr.snippets';
export const SNIPPET_STATE_VERSION = 1;

export const SnippetStateSchema = z.object({
  version: z.literal(SNIPPET_STATE_VERSION),
  snippets: z.array(SnippetSchema),
});

export type SnippetState = z.infer<typeof SnippetStateSchema>;

export function createEmptySnippetState(): SnippetState {
  return {
    version: SNIPPET_STATE_VERSION,
    snippets: [],
  };
}
