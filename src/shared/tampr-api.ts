export const TAMPR_BADGE_HIT_MESSAGE = 'tampr/runtime/hit';
export const TAMPR_DOWNLOAD_MESSAGE = 'tampr/api/download';

export type TamprBadgeHitMessage = {
  type: typeof TAMPR_BADGE_HIT_MESSAGE;
  snippetId: string;
};

export type TamprBadgeHitResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

export type TamprDownloadTextPayload = {
  filename: string;
  mimeType?: string;
  saveAs?: boolean;
  text: string;
  url?: never;
};

export type TamprDownloadUrlPayload = {
  filename: string;
  mimeType?: never;
  saveAs?: boolean;
  text?: never;
  url: string;
};

export type TamprDownloadPayload =
  | TamprDownloadTextPayload
  | TamprDownloadUrlPayload;

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
