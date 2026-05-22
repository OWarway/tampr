const DEV_RELOAD_MARKER_PATH = 'dev/reload.json';
const DEV_RELOAD_POLL_MS = 800;

let reloadWatcherStarted = false;

export function startDevReloadWatcher(): void {
  if (reloadWatcherStarted) {
    return;
  }

  reloadWatcherStarted = true;

  let previousMarker: string | undefined;
  let reloadStarted = false;

  const poll = async () => {
    if (reloadStarted) {
      return;
    }

    const marker = await readReloadMarker();

    if (!marker) {
      return;
    }

    if (!previousMarker) {
      previousMarker = marker;
      return;
    }

    if (previousMarker !== marker) {
      reloadStarted = true;
      chrome.runtime.reload();
    }
  };

  void poll();
  setInterval(() => void poll(), DEV_RELOAD_POLL_MS);
}

async function readReloadMarker(): Promise<string | undefined> {
  try {
    const markerUrl = chrome.runtime.getURL(DEV_RELOAD_MARKER_PATH);
    const response = await fetch(`${markerUrl}?time=${Date.now()}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return undefined;
    }

    return response.text();
  } catch {
    return undefined;
  }
}
