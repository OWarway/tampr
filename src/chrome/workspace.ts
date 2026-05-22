export async function openWorkspace(): Promise<void> {
  await chrome.runtime.openOptionsPage();
}
