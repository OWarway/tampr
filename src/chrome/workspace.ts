import { WORKSPACE_SOURCE_PAGE_PARAM } from '../shared/workspace-source-page';
import { getActivePageUrl } from './active-page';

export async function openWorkspace(): Promise<void> {
  const sourcePageUrl = await getActivePageUrl();

  if (!sourcePageUrl) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  const workspaceUrl = new URL(chrome.runtime.getURL('workspace.html'));
  workspaceUrl.searchParams.set(WORKSPACE_SOURCE_PAGE_PARAM, sourcePageUrl);

  await chrome.tabs.create({ url: workspaceUrl.href });
}
