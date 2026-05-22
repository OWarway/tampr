import type {
  PageState,
  PageStateResponse,
} from '../shared/workspace-messages';

export async function getPageState(pageUrl: string): Promise<PageState> {
  const response = (await chrome.runtime.sendMessage({
    type: 'page/get-state',
    pageUrl,
  })) as PageStateResponse | { ok: false; error: string };

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.state;
}
