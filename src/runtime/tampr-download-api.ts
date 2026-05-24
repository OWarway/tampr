import { z } from 'zod';

import { SnippetIdSchema } from '../domain/snippets';
import {
  TAMPR_DOWNLOAD_MESSAGE,
  type TamprDownloadResponse,
} from '../shared/tampr-api';

const DEFAULT_MIME_TYPE = 'text/plain;charset=utf-8';
const MAX_DOWNLOAD_TEXT_LENGTH = 5_000_000;
const MAX_DOWNLOAD_URL_LENGTH = 2_000;
const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:']);

type DownloadsApi = Pick<typeof chrome.downloads, 'download'>;

const DownloadFilenameSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .refine(isSafeDownloadFilename, {
    message:
      'Download filenames must be relative paths without parent segments or reserved characters.',
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

const DownloadUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_DOWNLOAD_URL_LENGTH)
  .refine(isSafeDownloadUrl, {
    message: 'Download URLs must use http or https.',
  });

const TamprDownloadTextPayloadSchema = z
  .object({
    filename: DownloadFilenameSchema,
    mimeType: DownloadMimeTypeSchema,
    saveAs: z.boolean().default(true),
    text: z.string().max(MAX_DOWNLOAD_TEXT_LENGTH),
  })
  .strict();

const TamprDownloadUrlPayloadSchema = z
  .object({
    filename: DownloadFilenameSchema,
    saveAs: z.boolean().default(true),
    url: DownloadUrlSchema,
  })
  .strict();

export const TamprDownloadPayloadSchema = z.union([
  TamprDownloadTextPayloadSchema,
  TamprDownloadUrlPayloadSchema,
]);

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
  const url =
    'url' in payload
      ? payload.url
      : buildTextDataUrl(payload.mimeType, payload.text);

  try {
    const downloadId = await downloadsApi.download({
      conflictAction: 'uniquify',
      filename: payload.filename,
      saveAs: payload.saveAs,
      url,
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
  if (filename.includes('\\') || filename.startsWith('/')) {
    return false;
  }

  const segments = filename.split('/');

  for (const segment of segments) {
    if (!isSafeFilenameSegment(segment)) {
      return false;
    }
  }

  const lastSegment = segments[segments.length - 1];

  return lastSegment !== undefined && lastSegment.length > 0;
}

function isSafeFilenameSegment(segment: string): boolean {
  if (segment.length === 0 || segment === '.' || segment === '..') {
    return false;
  }

  if (/[<>:"|?*]/.test(segment)) {
    return false;
  }

  for (let index = 0; index < segment.length; index += 1) {
    if (segment.charCodeAt(index) < 32) {
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

function isSafeDownloadUrl(url: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  return ALLOWED_URL_PROTOCOLS.has(parsed.protocol);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
