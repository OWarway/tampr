import {
  sanitizeWebPageUrl,
  WORKSPACE_SOURCE_PAGE_PARAM,
} from '../shared/workspace-source-page';

export async function openWorkspace(): Promise<void> {
  const sourcePageUrl = await getActiveSourcePageUrl();

  if (!sourcePageUrl) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  const workspaceUrl = new URL(chrome.runtime.getURL('workspace.html'));
  workspaceUrl.searchParams.set(WORKSPACE_SOURCE_PAGE_PARAM, sourcePageUrl);

  await chrome.tabs.create({ url: workspaceUrl.href });
}

async function getActiveSourcePageUrl(): Promise<string | undefined> {
  if (!chrome.tabs?.query) {
    return undefined;
  }

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    return tab?.url ? sanitizeWebPageUrl(tab.url) : undefined;
  } catch {
    return undefined;
  }
}
