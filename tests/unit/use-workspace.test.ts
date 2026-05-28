// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildSnippet,
  DEFAULT_SNIPPET_FOLDER,
  SnippetDraftSchema,
  type Snippet,
} from '../../src/domain/snippets';
import type {
  ExtensionMessage,
  WorkspaceState,
} from '../../src/shared/workspace-messages';
import { useWorkspace } from '../../src/workspace/hooks/use-workspace';

afterEach(() => {
  window.history.replaceState({}, '', '/');
  vi.unstubAllGlobals();
});

describe('useWorkspace', () => {
  it('opens the requested snippet from workspace URL context', async () => {
    const firstSnippet = createSnippet({
      id: 'snippet-1',
      name: 'First snippet',
    });
    const selectedSnippet = createSnippet({
      id: 'blueprint-snippet',
      name: 'Hide Subscribe panel',
    });

    window.history.replaceState(
      {},
      '',
      '/workspace.html?snippet=blueprint-snippet',
    );
    stubWorkspaceMessages((message) => {
      if (message.type === 'workspace/get-state') {
        return workspaceState([firstSnippet, selectedSnippet]);
      }

      throw new Error('Unexpected message.');
    });

    const { result } = renderHook(() => useWorkspace());

    await waitFor(() => expect(result.current.workspace).toBeDefined());

    expect(result.current.editor).toMatchObject({
      id: 'blueprint-snippet',
      name: 'Hide Subscribe panel',
    });
  });

  it('auto-saves saved folder moves without writing unrelated editor changes', async () => {
    const savedSnippet = createSnippet({
      id: 'snippet-1',
      folder: DEFAULT_SNIPPET_FOLDER,
      css: 'body { color: red; }',
      name: 'Theme cleanup',
    });
    const movedSnippet = { ...savedSnippet, folder: 'Design' };
    const sendMessage = stubWorkspaceMessages((message) => {
      if (message.type === 'workspace/get-state') {
        return workspaceState([savedSnippet]);
      }

      if (message.type === 'snippets/save') {
        return workspaceState([movedSnippet]);
      }

      throw new Error('Unexpected message.');
    });

    const { result } = renderHook(() => useWorkspace());

    await waitFor(() => expect(result.current.workspace).toBeDefined());

    act(() => {
      result.current.updateEditor({
        ...result.current.editor,
        css: 'body { color: green; }',
      });
    });

    act(() => {
      result.current.updateEditorFolder('Design');
    });

    await waitFor(() => expect(result.current.notice).toBe('Folder saved.'));

    const saveMessage = sentMessages(sendMessage).find(
      (message) => message.type === 'snippets/save',
    );

    expect(saveMessage).toMatchObject({
      draft: {
        id: 'snippet-1',
        folder: 'Design',
        css: 'body { color: red; }',
      },
      type: 'snippets/save',
    });
    expect(result.current.editor).toMatchObject({
      css: 'body { color: green; }',
      folder: 'Design',
    });
  });

  it('renames folders without overwriting editor draft changes', async () => {
    const savedSnippet = createSnippet({
      id: 'snippet-1',
      folder: 'Design',
      css: 'body { color: red; }',
      name: 'Theme cleanup',
    });
    const renamedSnippet = { ...savedSnippet, folder: 'Research' };
    const sendMessage = stubWorkspaceMessages((message) => {
      if (message.type === 'workspace/get-state') {
        return workspaceState([savedSnippet]);
      }

      if (message.type === 'folders/rename') {
        return workspaceState([renamedSnippet]);
      }

      throw new Error('Unexpected message.');
    });

    const { result } = renderHook(() => useWorkspace());

    await waitFor(() => expect(result.current.workspace).toBeDefined());

    act(() => {
      result.current.updateEditor({
        ...result.current.editor,
        css: 'body { color: green; }',
      });
    });

    await act(async () => {
      await result.current.renameFolder('Design', 'Research');
    });

    expect(sentMessages(sendMessage)).toContainEqual({
      folder: 'Design',
      nextFolder: 'Research',
      type: 'folders/rename',
    });
    expect(result.current.notice).toBe('Folder renamed to Research.');
    expect(result.current.editor).toMatchObject({
      css: 'body { color: green; }',
      folder: 'Research',
    });
    expect(result.current.workspace?.snippets).toEqual([renamedSnippet]);
  });

  it('moves deleted folders to General', async () => {
    const savedSnippet = createSnippet({
      id: 'snippet-1',
      folder: 'Archived',
      name: 'Old workflow',
    });
    const movedSnippet = { ...savedSnippet, folder: DEFAULT_SNIPPET_FOLDER };
    const sendMessage = stubWorkspaceMessages((message) => {
      if (message.type === 'workspace/get-state') {
        return workspaceState([savedSnippet]);
      }

      if (message.type === 'folders/delete') {
        return workspaceState([movedSnippet]);
      }

      throw new Error('Unexpected message.');
    });

    const { result } = renderHook(() => useWorkspace());

    await waitFor(() => expect(result.current.workspace).toBeDefined());

    await act(async () => {
      await result.current.deleteFolder('Archived');
    });

    expect(sentMessages(sendMessage)).toContainEqual({
      folder: 'Archived',
      type: 'folders/delete',
    });
    expect(result.current.notice).toBe(
      `Folder moved to ${DEFAULT_SNIPPET_FOLDER}.`,
    );
    expect(result.current.editor).toMatchObject({
      folder: DEFAULT_SNIPPET_FOLDER,
    });
    expect(result.current.workspace?.snippets).toEqual([movedSnippet]);
  });
});

type MessageHandler = (message: ExtensionMessage) => WorkspaceState;

function stubWorkspaceMessages(handler: MessageHandler) {
  const sendMessage = vi.fn(
    async (message: ExtensionMessage): Promise<unknown> => {
      try {
        return {
          ok: true,
          state: handler(message),
        };
      } catch (error: unknown) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage,
    },
  });

  return sendMessage;
}

function sentMessages(sendMessage: ReturnType<typeof stubWorkspaceMessages>) {
  return sendMessage.mock.calls.map(([message]) => message as ExtensionMessage);
}

type CreateSnippetInput = {
  css?: string;
  folder?: string;
  id: string;
  name?: string;
};

function createSnippet({
  css = 'body { color: blue; }',
  folder = DEFAULT_SNIPPET_FOLDER,
  id,
  name = 'Existing proof',
}: CreateSnippetInput): Snippet {
  return buildSnippet({
    id,
    now: 1_748_000_000_000,
    draft: SnippetDraftSchema.parse({
      name,
      folder,
      matches: ['*://example.com/*'],
      css,
    }),
  });
}

function workspaceState(snippets: Snippet[]): WorkspaceState {
  return {
    snippets,
    runtime: readyRuntime(),
  };
}

function readyRuntime() {
  return {
    state: 'ready' as const,
    registrations: 1,
    skipped: [],
    errors: [],
  };
}
