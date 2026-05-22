import { z } from 'zod';

import {
  SnippetDraftSchema,
  SnippetIdSchema,
  SnippetSchema,
} from '../domain/snippets';
import type { RuntimeStatus } from '../runtime/runtime-status';

export const GetWorkspaceStateMessageSchema = z.object({
  type: z.literal('workspace/get-state'),
});

export const SaveSnippetMessageSchema = z.object({
  type: z.literal('snippets/save'),
  draft: SnippetDraftSchema,
});

export const RemoveSnippetMessageSchema = z.object({
  type: z.literal('snippets/remove'),
  snippetId: SnippetIdSchema,
});

export const WorkspaceMessageSchema = z.union([
  GetWorkspaceStateMessageSchema,
  SaveSnippetMessageSchema,
  RemoveSnippetMessageSchema,
]);

export type WorkspaceMessage = z.infer<typeof WorkspaceMessageSchema>;

export type WorkspaceState = {
  snippets: z.infer<typeof SnippetSchema>[];
  runtime: RuntimeStatus;
};

export type WorkspaceResponse =
  | {
      ok: true;
      state: WorkspaceState;
    }
  | {
      ok: false;
      error: string;
    };
