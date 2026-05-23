import { test as base, chromium, type BrowserContext } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
};

const projectRoot = fileURLToPath(new URL('../../..', import.meta.url));
const extensionPath = resolve(projectRoot, 'dist');

export const test = base.extend<ExtensionFixtures>({
  context: async ({ browserName }, run, testInfo) => {
    if (browserName !== 'chromium') {
      throw new Error('Tampr extension smoke tests require Chromium.');
    }

    const context = await chromium.launchPersistentContext(
      testInfo.outputPath('profile'),
      {
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
        ],
        channel: 'chromium',
      },
    );

    await run(context);
    await context.close();
  },

  extensionId: async ({ context }, run) => {
    let serviceWorker = context.serviceWorkers()[0];

    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    await run(new URL(serviceWorker.url()).host);
  },
});

export { expect } from '@playwright/test';
