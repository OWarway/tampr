type ObjectUrlApi = {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
};

type DownloadJsonInput = {
  filename: string;
  value: unknown;
  documentRef?: Document;
  objectUrlApi?: ObjectUrlApi;
};

export function downloadJson({
  filename,
  value,
  documentRef = document,
  objectUrlApi = URL,
}: DownloadJsonInput): void {
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
