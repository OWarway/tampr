import { expect, test } from './fixtures/extension';

test('loads the built extension popup and workspace surfaces', async ({
  extensionId,
  page,
}) => {
  await page.goto(`chrome-extension://${extensionId}/workspace.html`);

  await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'CSS' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rules' })).toBeVisible();

  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(page.getByRole('heading', { name: 'Tampr' })).toBeVisible();
  await expect(page.getByLabel('Page snippets')).toBeVisible();
  await expect(page.getByText('Web page needed')).toBeVisible();
});
