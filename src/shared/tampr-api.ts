export const TAMPR_DOWNLOAD_MESSAGE = 'tampr/api/download';

export type TamprDownloadPayload = {
  filename: string;
  mimeType?: string;
  saveAs?: boolean;
  text: string;
};

export type TamprDownloadMessage = {
  type: typeof TAMPR_DOWNLOAD_MESSAGE;
  snippetId: string;
  payload: TamprDownloadPayload;
};

export type TamprDownloadResponse =
  | {
      ok: true;
      downloadId: number;
    }
  | {
      ok: false;
      error: string;
    };
