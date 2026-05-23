import { describe, expect, it, vi } from 'vitest';

import { downloadJson } from '../../src/workspace/download-json';

describe('downloadJson', () => {
  it('uses the browser downloads API when it is available', async () => {
    const download = vi.fn().mockResolvedValue(1);

    await expect(
      downloadJson({
        browserApi: {
          downloads: { download },
        },
        filename: 'tampr-snippets.json',
        value: { format: 'tampr' },
      }),
    ).resolves.toEqual({ mode: 'browser-api' });

    expect(download).toHaveBeenCalledWith({
      filename: 'tampr-snippets.json',
      saveAs: true,
      url: `data:application/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify({ format: 'tampr' }, null, 2),
      )}`,
    });
  });

  it('falls back to anchor downloads when browser downloads are unavailable', async () => {
    const objectUrlApi = {
      createObjectURL: vi.fn().mockReturnValue('blob:tampr-export'),
      revokeObjectURL: vi.fn(),
    };
    const { anchor, documentRef } = createFakeDocument();

    await expect(
      downloadJson({
        documentRef,
        filename: 'tampr-snippets.json',
        objectUrlApi,
        value: { format: 'tampr' },
      }),
    ).resolves.toEqual({ mode: 'anchor' });

    expect(anchor.download).toBe('tampr-snippets.json');
    expect(anchor.href).toBe('blob:tampr-export');
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(anchor.remove).toHaveBeenCalledTimes(1);
    expect(objectUrlApi.revokeObjectURL).toHaveBeenCalledWith(
      'blob:tampr-export',
    );
  });

  it('throws browser API download errors in explicit browser-api mode', async () => {
    await expect(
      downloadJson({
        browserApi: {
          downloads: {
            download: vi.fn().mockRejectedValue(new Error('Download failed.')),
          },
        },
        filename: 'tampr-snippets.json',
        mode: 'browser-api',
        value: { format: 'tampr' },
      }),
    ).rejects.toThrow('Download failed.');
  });

  it('throws unavailable downloads in explicit browser-api mode', async () => {
    await expect(
      downloadJson({
        filename: 'tampr-snippets.json',
        mode: 'browser-api',
        value: { format: 'tampr' },
      }),
    ).rejects.toThrow('Browser download API is unavailable.');
  });
});

function createFakeDocument(): {
  anchor: HTMLAnchorElement;
  documentRef: Document;
} {
  const anchor = {
    click: vi.fn(),
    download: '',
    href: '',
    rel: '',
    remove: vi.fn(),
    style: { display: '' },
  } as unknown as HTMLAnchorElement;

  const documentRef = {
    body: {
      append: vi.fn(),
    },
    createElement: vi.fn().mockReturnValue(anchor),
  } as unknown as Document;

  return { anchor, documentRef };
}
