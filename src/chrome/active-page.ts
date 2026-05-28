import { sanitizeWebPageUrl } from '../shared/workspace-source-page';

export type ActivePageContext = {
  tabId: number;
  url: string;
};

export async function getActivePageUrl(): Promise<string | undefined> {
  const tab = await getActiveTab();

  return tab?.url ? sanitizeWebPageUrl(tab.url) : undefined;
}

export async function getActivePageContext(): Promise<
  ActivePageContext | undefined
> {
  const tab = await getActiveTab();
  const url = tab?.url ? sanitizeWebPageUrl(tab.url) : undefined;

  return tab?.id && url
    ? {
        tabId: tab.id,
        url,
      }
    : undefined;
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  if (!chrome.tabs?.query) {
    return undefined;
  }

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    return tab;
  } catch {
    return undefined;
  }
}
