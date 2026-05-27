export async function openExtensionDetails(): Promise<void> {
  const extensionId = chrome.runtime.id;
  const detailsUrl = `chrome://extensions/?id=${encodeURIComponent(extensionId)}`;

  if (chrome.tabs?.create) {
    await chrome.tabs.create({ url: detailsUrl });
    return;
  }

  await chrome.runtime.openOptionsPage?.();
}
