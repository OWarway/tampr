import { z } from 'zod';

import { SnippetIdSchema } from '../domain/snippets';
import {
  TAMPR_DOWNLOAD_MESSAGE,
  type TamprDownloadResponse,
} from '../shared/tampr-api';

const DEFAULT_MIME_TYPE = 'text/plain;charset=utf-8';
const MAX_DOWNLOAD_TEXT_LENGTH = 5_000_000;

type DownloadsApi = Pick<typeof chrome.downloads, 'download'>;

const DownloadFilenameSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .refine(isSafeDownloadFilename, {
    message:
      'Download filenames must be simple filenames without paths or reserved characters.',
  });

const DownloadMimeTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(isSafeMimeType, {
    message: 'Download MIME types must be single-line media types.',
  })
  .default(DEFAULT_MIME_TYPE);

export const TamprDownloadPayloadSchema = z
  .object({
    filename: DownloadFilenameSchema,
    mimeType: DownloadMimeTypeSchema,
    saveAs: z.boolean().default(true),
    text: z.string().max(MAX_DOWNLOAD_TEXT_LENGTH),
  })
  .strict();

export const TamprDownloadMessageSchema = z
  .object({
    type: z.literal(TAMPR_DOWNLOAD_MESSAGE),
    snippetId: SnippetIdSchema,
    payload: TamprDownloadPayloadSchema,
  })
  .strict();

export async function handleTamprDownloadMessage(
  message: unknown,
  downloadsApi: DownloadsApi = chrome.downloads,
): Promise<TamprDownloadResponse> {
  const validation = TamprDownloadMessageSchema.safeParse(message);

  if (!validation.success) {
    return {
      ok: false,
      error: 'Invalid Tampr download request.',
    };
  }

  const { payload } = validation.data;

  try {
    const downloadId = await downloadsApi.download({
      conflictAction: 'uniquify',
      filename: payload.filename,
      saveAs: payload.saveAs,
      url: buildTextDataUrl(payload.mimeType, payload.text),
    });

    return {
      ok: true,
      downloadId,
    };
  } catch (error: unknown) {
    return {
      ok: false,
      error: toErrorMessage(error),
    };
  }
}

function buildTextDataUrl(mimeType: string, text: string): string {
  return `data:${mimeType},${encodeURIComponent(text)}`;
}

function isSafeDownloadFilename(filename: string): boolean {
  if (filename === '.' || filename === '..') {
    return false;
  }

  if (/[<>:"/\\|?*]/.test(filename)) {
    return false;
  }

  for (let index = 0; index < filename.length; index += 1) {
    if (filename.charCodeAt(index) < 32) {
      return false;
    }
  }

  return true;
}

function isSafeMimeType(mimeType: string): boolean {
  return (
    mimeType.includes('/') &&
    !mimeType.includes(',') &&
    !mimeType.includes('\r') &&
    !mimeType.includes('\n')
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
