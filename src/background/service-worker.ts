import { startDevReloadWatcher } from '../dev/reload-extension';
import { handleTamprDownloadMessage } from '../runtime/tampr-download-api';
import { syncChromeUserScripts } from '../runtime/user-script-runtime';
import {
  isPickBlueprintSelectorMessage,
  isStartBlueprintCreatorMessage,
  isTestBlueprintAutomationNodeMessage,
  isTestBlueprintSelectorMessage,
} from '../shared/blueprint-messages';
import type { ExtensionResponse } from '../shared/workspace-messages';
import { createChromeSnippetRepository } from '../storage/snippet-repository';
import { ActionBadgeController } from './action-badge';
import { BlueprintController } from './blueprint-controller';
import { WorkspaceController } from './workspace-controller';

const snippets = createChromeSnippetRepository();
const actionBadge = new ActionBadgeController(chrome.action);
const blueprints = new BlueprintController({
  createId: () => crypto.randomUUID(),
  getExtensionUrl: (path) => chrome.runtime.getURL(path),
  now: () => Date.now(),
  runtimeSync: syncChromeUserScripts,
  scripting: chrome.scripting,
  snippets,
  tabs: chrome.tabs,
});
const workspace = new WorkspaceController({
  createId: () => crypto.randomUUID(),
  now: () => Date.now(),
  runtimeSync: syncChromeUserScripts,
  snippets,
});

if (import.meta.env.MODE === 'development') {
  startDevReloadWatcher();
}

actionBadge.installTabListeners(chrome.tabs);

chrome.runtime.onInstalled.addListener(() => {
  void actionBadge.clearAll();
  void workspace.syncStoredSnippets();
});

chrome.runtime.onStartup.addListener(() => {
  void workspace.syncStoredSnippets();
});

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (isStartBlueprintCreatorMessage(message)) {
      void blueprints
        .startCreator()
        .then(sendResponse)
        .catch((error: unknown) => {
          sendResponse(toErrorResponse(error));
        });

      return true;
    }

    if (isPickBlueprintSelectorMessage(message)) {
      void blueprints
        .pickSelector(message.sourceTabId)
        .then(sendResponse)
        .catch((error: unknown) => {
          sendResponse(toErrorResponse(error));
        });

      return true;
    }

    if (isTestBlueprintSelectorMessage(message)) {
      void blueprints
        .testSelector(message.sourceTabId, message.selector)
        .then(sendResponse)
        .catch((error: unknown) => {
          sendResponse(toErrorResponse(error));
        });

      return true;
    }

    if (isTestBlueprintAutomationNodeMessage(message)) {
      void blueprints
        .testAutomationNode(message.sourceTabId, message.node)
        .then(sendResponse)
        .catch((error: unknown) => {
          sendResponse(toErrorResponse(error));
        });

      return true;
    }

    void workspace
      .handleMessage(message)
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse(toErrorResponse(error));
      });

    return true;
  },
);

if (chrome.runtime.onUserScriptMessage) {
  chrome.runtime.onUserScriptMessage.addListener(
    (message: unknown, sender, sendResponse) => {
      if (actionBadge.isBadgeHitMessage(message)) {
        void actionBadge
          .handleBadgeHitMessage(message, sender)
          .then(sendResponse)
          .catch((error: unknown) => {
            sendResponse(toErrorResponse(error));
          });

        return true;
      }

      void handleTamprDownloadMessage(message)
        .then(sendResponse)
        .catch((error: unknown) => {
          sendResponse(toErrorResponse(error));
        });

      return true;
    },
  );
}

function toErrorResponse(error: unknown): ExtensionResponse {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  };
}
