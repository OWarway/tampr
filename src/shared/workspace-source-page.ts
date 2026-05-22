export const WORKSPACE_SOURCE_PAGE_PARAM = 'sourcePage';

export function getWorkspaceSourcePageUrl(
  workspaceUrl: string,
): string | undefined {
  try {
    const sourcePage = new URL(workspaceUrl).searchParams.get(
      WORKSPACE_SOURCE_PAGE_PARAM,
    );

    return sourcePage ? sanitizeWebPageUrl(sourcePage) : undefined;
  } catch {
    return undefined;
  }
}

export function sanitizeWebPageUrl(rawUrl: string): string | undefined {
  try {
    const url = new URL(rawUrl);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }

    url.hash = '';
    url.search = '';

    return url.href;
  } catch {
    return undefined;
  }
}
