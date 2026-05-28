import { buildWorkspaceUrl } from '../shared/workspace-source-page';
import { getActivePageContext } from './active-page';

export async function openWorkspace(): Promise<void> {
  const sourcePage = await getActivePageContext();

  if (!sourcePage) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  await chrome.tabs.create({
    url: buildWorkspaceUrl({
      baseUrl: chrome.runtime.getURL('workspace.html'),
      sourcePageUrl: sourcePage.url,
      sourceTabId: sourcePage.tabId,
    }),
  });
}
