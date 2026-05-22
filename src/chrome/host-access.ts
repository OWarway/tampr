export async function requestHostAccess(matches: string[]): Promise<boolean> {
  if (matches.length === 0) {
    return true;
  }

  return chrome.permissions.request({ origins: matches });
}
