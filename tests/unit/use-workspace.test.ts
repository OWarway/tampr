// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSnippet, SnippetDraftSchema } from '../../src/domain/snippets';
import type { ExtensionMessage } from '../../src/shared/workspace-messages';
import { useWorkspace } from '../../src/workspace/hooks/use-workspace';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useWorkspace', () => {
  it('auto-saves saved folder moves without writing unrelated editor changes', async () => {
    const savedSnippet = buildSnippet({
      id: 'snippet-1',
      now: 1_748_000_000_000,
      draft: SnippetDraftSchema.parse({
        name: 'Theme cleanup',
        folder: 'General',
        matches: ['*://example.com/*'],
        css: 'body { color: red; }',
      }),
    });
    const movedSnippet = { ...savedSnippet, folder: 'Design' };
    const sendMessage = vi.fn(
      async (message: ExtensionMessage): Promise<unknown> => {
        if (message.type === 'workspace/get-state') {
          return {
            ok: true,
            state: {
              snippets: [savedSnippet],
              runtime: readyRuntime(),
            },
          };
        }

        if (message.type === 'snippets/save') {
          return {
            ok: true,
            state: {
              snippets: [movedSnippet],
              runtime: readyRuntime(),
            },
          };
        }

        return { ok: false, error: 'Unexpected message.' };
      },
    );

    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage,
      },
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

    const saveMessage = sendMessage.mock.calls
      .map(([message]) => message as ExtensionMessage)
      .find((message) => message.type === 'snippets/save');

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
});

function readyRuntime() {
  return {
    state: 'ready' as const,
    registrations: 1,
    skipped: [],
    errors: [],
  };
}
