export const WORKSPACE_SOURCE_PAGE_PARAM = 'sourcePage';
export const WORKSPACE_SELECTED_SNIPPET_PARAM = 'snippet';
export const WORKSPACE_SOURCE_TAB_PARAM = 'sourceTab';

const SNIPPET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

type BuildWorkspaceUrlInput = {
  baseUrl: string;
  selectedSnippetId?: string | undefined;
  sourceTabId?: number | undefined;
  sourcePageUrl?: string | undefined;
};

export function buildWorkspaceUrl({
  baseUrl,
  selectedSnippetId,
  sourceTabId,
  sourcePageUrl,
}: BuildWorkspaceUrlInput): string {
  const workspaceUrl = new URL(baseUrl);
  const sanitizedSourcePageUrl = sourcePageUrl
    ? sanitizeWebPageUrl(sourcePageUrl)
    : undefined;

  if (sanitizedSourcePageUrl) {
    workspaceUrl.searchParams.set(
      WORKSPACE_SOURCE_PAGE_PARAM,
      sanitizedSourcePageUrl,
    );
  }

  if (selectedSnippetId && SNIPPET_ID_PATTERN.test(selectedSnippetId)) {
    workspaceUrl.searchParams.set(
      WORKSPACE_SELECTED_SNIPPET_PARAM,
      selectedSnippetId,
    );
  }

  if (sourceTabId && Number.isInteger(sourceTabId) && sourceTabId > 0) {
    workspaceUrl.searchParams.set(
      WORKSPACE_SOURCE_TAB_PARAM,
      String(sourceTabId),
    );
  }

  return workspaceUrl.href;
}

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

export function getWorkspaceSelectedSnippetId(
  workspaceUrl: string,
): string | undefined {
  try {
    const selectedSnippetId = new URL(workspaceUrl).searchParams.get(
      WORKSPACE_SELECTED_SNIPPET_PARAM,
    );

    return selectedSnippetId && SNIPPET_ID_PATTERN.test(selectedSnippetId)
      ? selectedSnippetId
      : undefined;
  } catch {
    return undefined;
  }
}

export function getWorkspaceSourceTabId(
  workspaceUrl: string,
): number | undefined {
  try {
    const sourceTabId = Number(
      new URL(workspaceUrl).searchParams.get(WORKSPACE_SOURCE_TAB_PARAM),
    );

    return Number.isInteger(sourceTabId) && sourceTabId > 0
      ? sourceTabId
      : undefined;
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
