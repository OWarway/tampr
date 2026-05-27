import { afterEach, describe, expect, it, vi } from 'vitest';

import { openExtensionDetails } from '../../src/chrome/extension-settings';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('openExtensionDetails', () => {
  it('opens the Chrome extension details page for Tampr', async () => {
    const create = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('chrome', {
      runtime: { id: 'tampr-extension-id' },
      tabs: { create },
    });

    await openExtensionDetails();

    expect(create).toHaveBeenCalledWith({
      url: 'chrome://extensions/?id=tampr-extension-id',
    });
  });

  it('falls back to the options page if tab creation is unavailable', async () => {
    const openOptionsPage = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('chrome', {
      runtime: {
        id: 'tampr-extension-id',
        openOptionsPage,
      },
    });

    await openExtensionDetails();

    expect(openOptionsPage).toHaveBeenCalledTimes(1);
  });
});
