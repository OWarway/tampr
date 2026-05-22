import { buildSnippet, SnippetDraftSchema } from '../domain/snippets';
import { syncChromeUserScripts } from '../runtime/user-script-runtime';
import {
  WorkspaceMessageSchema,
  type WorkspaceResponse,
  type WorkspaceState,
} from '../shared/workspace-messages';
import { createChromeSnippetRepository } from '../storage/snippet-repository';

const snippets = createChromeSnippetRepository();

chrome.runtime.onInstalled.addListener(() => {
  void chrome.action.setBadgeText({ text: '' });
  void syncStoredSnippets();
});

chrome.runtime.onStartup.addListener(() => {
  void syncStoredSnippets();
});

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    void handleMessage(message)
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse(toErrorResponse(error));
      });

    return true;
  },
);

async function handleMessage(message: unknown): Promise<WorkspaceResponse> {
  const parsedMessage = WorkspaceMessageSchema.safeParse(message);

  if (!parsedMessage.success) {
    return {
      ok: false,
      error: 'Unsupported Tampr message.',
    };
  }

  if (parsedMessage.data.type === 'workspace/get-state') {
    return {
      ok: true,
      state: await readWorkspaceState(),
    };
  }

  if (parsedMessage.data.type === 'snippets/remove') {
    await snippets.remove(parsedMessage.data.snippetId);

    return {
      ok: true,
      state: await readWorkspaceState(),
    };
  }

  const draft = SnippetDraftSchema.parse(parsedMessage.data.draft);
  const previous = draft.id ? await snippets.find(draft.id) : undefined;
  const snippet = buildSnippet({
    draft,
    id: previous?.id ?? draft.id ?? crypto.randomUUID(),
    now: Date.now(),
    previous,
  });

  await snippets.save(snippet);

  return {
    ok: true,
    state: await readWorkspaceState(),
  };
}

async function readWorkspaceState(): Promise<WorkspaceState> {
  const savedSnippets = await snippets.list();

  return {
    snippets: savedSnippets,
    runtime: await syncChromeUserScripts(savedSnippets),
  };
}

async function syncStoredSnippets(): Promise<void> {
  const savedSnippets = await snippets.list();
  await syncChromeUserScripts(savedSnippets);
}

function toErrorResponse(error: unknown): WorkspaceResponse {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  };
}
