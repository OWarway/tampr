import { startDevReloadWatcher } from '../dev/reload-extension';
import { syncChromeUserScripts } from '../runtime/user-script-runtime';
import type { WorkspaceResponse } from '../shared/workspace-messages';
import { createChromeSnippetRepository } from '../storage/snippet-repository';
import { WorkspaceController } from './workspace-controller';

const snippets = createChromeSnippetRepository();
const workspace = new WorkspaceController({
  createId: () => crypto.randomUUID(),
  now: () => Date.now(),
  runtimeSync: syncChromeUserScripts,
  snippets,
});

if (import.meta.env.MODE === 'development') {
  startDevReloadWatcher();
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.action.setBadgeText({ text: '' });
  void workspace.syncStoredSnippets();
});

chrome.runtime.onStartup.addListener(() => {
  void workspace.syncStoredSnippets();
});

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    void workspace
      .handleMessage(message)
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse(toErrorResponse(error));
      });

    return true;
  },
);

function toErrorResponse(error: unknown): WorkspaceResponse {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  };
}
