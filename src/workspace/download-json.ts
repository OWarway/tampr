type ObjectUrlApi = {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
};

type BrowserDownloadApi = {
  downloads?: Pick<typeof chrome.downloads, 'download'>;
};

export type DownloadJsonMode = 'anchor' | 'auto' | 'browser-api';

export type DownloadJsonResult = {
  mode: 'anchor' | 'browser-api';
};

type DownloadJsonInput = {
  browserApi?: BrowserDownloadApi | undefined;
  filename: string;
  mode?: DownloadJsonMode;
  value: unknown;
  documentRef?: Document;
  objectUrlApi?: ObjectUrlApi;
};

export async function downloadJson({
  browserApi = typeof chrome === 'undefined' ? undefined : chrome,
  filename,
  mode = 'auto',
  value,
  documentRef,
  objectUrlApi = URL,
}: DownloadJsonInput): Promise<DownloadJsonResult> {
  if (mode !== 'anchor') {
    const downloadedWithBrowserApi = await downloadWithBrowserApi({
      browserApi,
      filename,
      mode,
      value,
    });

    if (downloadedWithBrowserApi) {
      return { mode: 'browser-api' };
    }
  }

  downloadWithAnchor({
    documentRef: documentRef ?? document,
    filename,
    objectUrlApi,
    value,
  });

  return { mode: 'anchor' };
}

type DownloadWithBrowserApiInput = {
  browserApi: BrowserDownloadApi | undefined;
  filename: string;
  mode: Exclude<DownloadJsonMode, 'anchor'>;
  value: unknown;
};

async function downloadWithBrowserApi({
  browserApi,
  filename,
  mode,
  value,
}: DownloadWithBrowserApiInput): Promise<boolean> {
  try {
    if (!browserApi?.downloads?.download) {
      return handleBrowserApiUnavailable(
        mode,
        'Browser download API is unavailable.',
      );
    }

    await browserApi.downloads.download({
      filename,
      saveAs: true,
      url: `data:application/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(value, null, 2),
      )}`,
    });

    return true;
  } catch (error: unknown) {
    if (mode === 'browser-api') {
      throw error;
    }

    return false;
  }
}

function handleBrowserApiUnavailable(
  mode: Exclude<DownloadJsonMode, 'anchor'>,
  message: string,
): false {
  if (mode === 'browser-api') {
    throw new Error(message);
  }

  return false;
}

type DownloadWithAnchorInput = {
  documentRef: Document;
  filename: string;
  objectUrlApi: ObjectUrlApi;
  value: unknown;
};

function downloadWithAnchor({
  documentRef,
  filename,
  objectUrlApi,
  value,
}: DownloadWithAnchorInput): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json',
  });
  const objectUrl = objectUrlApi.createObjectURL(blob);
  const anchor = documentRef.createElement('a');

  anchor.download = filename;
  anchor.href = objectUrl;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';

  documentRef.body.append(anchor);
  anchor.click();
  anchor.remove();

  objectUrlApi.revokeObjectURL(objectUrl);
}
