import { sanitizeWebPageUrl } from '../shared/workspace-source-page';

export async function getActivePageUrl(): Promise<string | undefined> {
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
