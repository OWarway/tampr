import { buildWorkspaceUrl } from '../shared/workspace-source-page';
import { getActivePageUrl } from './active-page';

export async function openWorkspace(): Promise<void> {
  const sourcePageUrl = await getActivePageUrl();

  if (!sourcePageUrl) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  await chrome.tabs.create({
    url: buildWorkspaceUrl({
      baseUrl: chrome.runtime.getURL('workspace.html'),
      sourcePageUrl,
    }),
  });
}
