import { z } from 'zod';

import {
  SnippetDraftSchema,
  SnippetIdSchema,
  SnippetSchema,
} from '../domain/snippets';
import type { RuntimeStatus } from '../runtime/runtime-status';
import type { PageSnippetStatus } from '../domain/page-snippet-status';

export const GetWorkspaceStateMessageSchema = z.object({
  type: z.literal('workspace/get-state'),
});

export const GetPageStateMessageSchema = z.object({
  type: z.literal('page/get-state'),
  pageUrl: z.url().refine((url) => {
    return url.startsWith('http://') || url.startsWith('https://');
  }, 'Page state needs an http or https URL.'),
});

export const SaveSnippetMessageSchema = z.object({
  type: z.literal('snippets/save'),
  draft: SnippetDraftSchema,
});

export const RemoveSnippetMessageSchema = z.object({
  type: z.literal('snippets/remove'),
  snippetId: SnippetIdSchema,
});

export const ExtensionMessageSchema = z.union([
  GetWorkspaceStateMessageSchema,
  GetPageStateMessageSchema,
  SaveSnippetMessageSchema,
  RemoveSnippetMessageSchema,
]);

export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>;

export type WorkspaceState = {
  snippets: z.infer<typeof SnippetSchema>[];
  runtime: RuntimeStatus;
};

export type PageState = PageSnippetStatus & {
  runtime: RuntimeStatus;
};

type SuccessfulResponse<TState> = {
  ok: true;
  state: TState;
};

export type ExtensionResponse =
  | WorkspaceStateResponse
  | PageStateResponse
  | {
      ok: false;
      error: string;
    };

export type WorkspaceStateResponse = SuccessfulResponse<WorkspaceState>;
export type PageStateResponse = SuccessfulResponse<PageState>;
