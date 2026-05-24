import { describe, expect, it, vi } from 'vitest';

import { handleTamprDownloadMessage } from '../../src/runtime/tampr-download-api';
import { TAMPR_DOWNLOAD_MESSAGE } from '../../src/shared/tampr-api';

describe('Tampr download API', () => {
  it('downloads text payloads through the browser downloads API', async () => {
    const download = vi.fn().mockResolvedValue(42);

    await expect(
      handleTamprDownloadMessage(
        {
          type: TAMPR_DOWNLOAD_MESSAGE,
          snippetId: 'snippet-1',
          payload: {
            filename: 'report.json',
            mimeType: 'application/json;charset=utf-8',
            saveAs: false,
            text: '{"ok":true}',
          },
        },
        { download },
      ),
    ).resolves.toEqual({ ok: true, downloadId: 42 });

    expect(download).toHaveBeenCalledWith({
      conflictAction: 'uniquify',
      filename: 'report.json',
      saveAs: false,
      url: `data:application/json;charset=utf-8,${encodeURIComponent(
        '{"ok":true}',
      )}`,
    });
  });

  it('defaults to a safe text download shape', async () => {
    const download = vi.fn().mockResolvedValue(7);

    await handleTamprDownloadMessage(
      {
        type: TAMPR_DOWNLOAD_MESSAGE,
        snippetId: 'snippet-1',
        payload: {
          filename: 'notes.txt',
          text: 'hello',
        },
      },
      { download },
    );

    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'notes.txt',
        saveAs: true,
        url: 'data:text/plain;charset=utf-8,hello',
      }),
    );
  });

  it('downloads remote URLs through the browser downloads API', async () => {
    const download = vi.fn().mockResolvedValue(9);

    await expect(
      handleTamprDownloadMessage(
        {
          type: TAMPR_DOWNLOAD_MESSAGE,
          snippetId: 'snippet-1',
          payload: {
            filename: 'clip.mp4',
            saveAs: false,
            url: 'https://cdn.example.com/videos/clip.mp4',
          },
        },
        { download },
      ),
    ).resolves.toEqual({ ok: true, downloadId: 9 });

    expect(download).toHaveBeenCalledWith({
      conflictAction: 'uniquify',
      filename: 'clip.mp4',
      saveAs: false,
      url: 'https://cdn.example.com/videos/clip.mp4',
    });
  });

  it('accepts relative subpath filenames so downloads can target a subfolder', async () => {
    const download = vi.fn().mockResolvedValue(11);

    await handleTamprDownloadMessage(
      {
        type: TAMPR_DOWNLOAD_MESSAGE,
        snippetId: 'snippet-1',
        payload: {
          filename: 'Tampr/videos/clip.mp4',
          url: 'https://cdn.example.com/clip.mp4',
        },
      },
      { download },
    );

    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'Tampr/videos/clip.mp4' }),
    );
  });

  it('rejects URL downloads with non-http schemes', async () => {
    const download = vi.fn();

    await expect(
      handleTamprDownloadMessage(
        {
          type: TAMPR_DOWNLOAD_MESSAGE,
          snippetId: 'snippet-1',
          payload: {
            filename: 'config.txt',
            url: 'file:///etc/passwd',
          },
        },
        { download },
      ),
    ).resolves.toEqual({
      ok: false,
      error: 'Invalid Tampr download request.',
    });

    expect(download).not.toHaveBeenCalled();
  });

  it('rejects filenames that try to leave the downloads root', async () => {
    const download = vi.fn();

    await expect(
      handleTamprDownloadMessage(
        {
          type: TAMPR_DOWNLOAD_MESSAGE,
          snippetId: 'snippet-1',
          payload: {
            filename: '../report.json',
            text: 'hello',
          },
        },
        { download },
      ),
    ).resolves.toEqual({
      ok: false,
      error: 'Invalid Tampr download request.',
    });

    expect(download).not.toHaveBeenCalled();
  });

  it('rejects absolute filenames', async () => {
    const download = vi.fn();

    await expect(
      handleTamprDownloadMessage(
        {
          type: TAMPR_DOWNLOAD_MESSAGE,
          snippetId: 'snippet-1',
          payload: {
            filename: '/etc/passwd',
            text: 'hello',
          },
        },
        { download },
      ),
    ).resolves.toEqual({
      ok: false,
      error: 'Invalid Tampr download request.',
    });

    expect(download).not.toHaveBeenCalled();
  });

  it('rejects backslash path separators', async () => {
    const download = vi.fn();

    await expect(
      handleTamprDownloadMessage(
        {
          type: TAMPR_DOWNLOAD_MESSAGE,
          snippetId: 'snippet-1',
          payload: {
            filename: 'Tampr\\clip.mp4',
            url: 'https://cdn.example.com/clip.mp4',
          },
        },
        { download },
      ),
    ).resolves.toEqual({
      ok: false,
      error: 'Invalid Tampr download request.',
    });

    expect(download).not.toHaveBeenCalled();
  });

  it('rejects payloads that mix text and url', async () => {
    const download = vi.fn();

    await expect(
      handleTamprDownloadMessage(
        {
          type: TAMPR_DOWNLOAD_MESSAGE,
          snippetId: 'snippet-1',
          payload: {
            filename: 'mixed.txt',
            text: 'hello',
            url: 'https://example.com/clip.mp4',
          },
        },
        { download },
      ),
    ).resolves.toEqual({
      ok: false,
      error: 'Invalid Tampr download request.',
    });

    expect(download).not.toHaveBeenCalled();
  });

  it('returns download failures to the script without throwing', async () => {
    await expect(
      handleTamprDownloadMessage(
        {
          type: TAMPR_DOWNLOAD_MESSAGE,
          snippetId: 'snippet-1',
          payload: {
            filename: 'report.txt',
            text: 'hello',
          },
        },
        { download: vi.fn().mockRejectedValue(new Error('Download failed.')) },
      ),
    ).resolves.toEqual({
      ok: false,
      error: 'Download failed.',
    });
  });
});
