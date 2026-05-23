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
