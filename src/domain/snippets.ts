import { z } from 'zod';

import { WebMatchPatternSchema } from './web-match-patterns';

export const SNIPPET_RUN_TIMINGS = ['document_start', 'document_idle'] as const;
export const SNIPPET_WORLDS = ['USER_SCRIPT', 'MAIN'] as const;
export const DEFAULT_SNIPPET_FOLDER = 'General';

export type SnippetRunTiming = (typeof SNIPPET_RUN_TIMINGS)[number];
export type SnippetWorld = (typeof SNIPPET_WORLDS)[number];

export type Snippet = {
  id: string;
  name: string;
  folder: string;
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

export const SnippetRunTimingSchema = z.enum(SNIPPET_RUN_TIMINGS);
export const SnippetWorldSchema = z.enum(SNIPPET_WORLDS);

export const SnippetIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
    'Snippet IDs must contain letters, numbers, underscores, or hyphens.',
  );

const SnippetCodeSchema = z.string().max(250_000);
const SnippetNameSchema = z.string().trim().min(1).max(120);
export const SnippetFolderSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim().length === 0
      ? DEFAULT_SNIPPET_FOLDER
      : value,
  z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((folder) => !hasControlCharacter(folder), {
      message: 'Folder names cannot contain control characters.',
    }),
);
const TimestampSchema = z.number().int().nonnegative();

export const SnippetSchema = z.object({
  id: SnippetIdSchema,
  name: SnippetNameSchema,
  folder: SnippetFolderSchema.default(DEFAULT_SNIPPET_FOLDER),
  enabled: z.boolean(),
  matches: z.array(WebMatchPatternSchema),
  excludeMatches: z.array(WebMatchPatternSchema),
  css: SnippetCodeSchema,
  js: SnippetCodeSchema,
  runAt: SnippetRunTimingSchema,
  world: SnippetWorldSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const SnippetDraftSchema = SnippetSchema.pick({
  id: true,
  name: true,
  folder: true,
  enabled: true,
  matches: true,
  excludeMatches: true,
  css: true,
  js: true,
  runAt: true,
  world: true,
})
  .partial({ id: true })
  .extend({
    enabled: z.boolean().default(true),
    folder: SnippetFolderSchema.default(DEFAULT_SNIPPET_FOLDER),
    excludeMatches: z.array(WebMatchPatternSchema).default([]),
    css: SnippetCodeSchema.default(''),
    js: SnippetCodeSchema.default(''),
    runAt: SnippetRunTimingSchema.default('document_idle'),
    world: SnippetWorldSchema.default('USER_SCRIPT'),
  });

export type SnippetDraft = z.infer<typeof SnippetDraftSchema>;

type EmptySnippetInput = {
  folder?: string;
  id: string;
  now: number;
  name?: string;
};

export function createEmptySnippet({
  folder = DEFAULT_SNIPPET_FOLDER,
  id,
  name = 'Untitled snippet',
  now,
}: EmptySnippetInput): Snippet {
  return {
    id,
    name,
    folder: SnippetFolderSchema.parse(folder),
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

type BuildSnippetInput = {
  draft: SnippetDraft;
  id: string;
  now: number;
  previous?: Snippet | undefined;
};

export function buildSnippet({
  draft,
  id,
  now,
  previous,
}: BuildSnippetInput): Snippet {
  return SnippetSchema.parse({
    ...draft,
    id,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  });
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) < 32) {
      return true;
    }
  }

  return false;
}
