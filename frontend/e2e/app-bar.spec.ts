import { expect, test, type Locator, type Page } from '@playwright/test';

async function expectRightAlignment(page: Page, account: Locator, refresh?: Locator) {
  const toolbar = page.getByRole('banner').locator('.MuiToolbar-root');
  const edge = await toolbar.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.right - parseFloat(getComputedStyle(element).paddingRight);
  });
  const accountBounds = (await account.boundingBox())!;
  expect(Math.abs(accountBounds.x + accountBounds.width - edge)).toBeLessThanOrEqual(1);
  if (refresh) {
    const actionBounds = (await refresh.boundingBox())!;
    expect(actionBounds.x + actionBounds.width).toBeLessThanOrEqual(accountBounds.x);
    expect(Math.abs(actionBounds.y + actionBounds.height / 2 - accountBounds.y - accountBounds.height / 2)).toBeLessThanOrEqual(1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('account stays at the right edge with actions immediately to its left, including narrow screens and long names', async ({ page }) => {
  let accountName = 'Person';
  await page.route('**/api/auth/session', route => route.fulfill({ json: {
    authenticated: true, csrfToken: 'layout-test', authAvailable: true, demoAvailable: false, demo: false, expiresAt: null,
  } }));
  await page.route('**/api/homes/', route => route.fulfill({ json: {
    homes: [{ id: 'layout-home', name: 'Home', timezone: 'UTC' }], warnings: [], accountName,
  } }));
  await page.route('**/api/homes/layout-home/measurements', route => route.fulfill({ json: {
    homeId: 'layout-home', timezone: 'UTC', fetchedAt: new Date().toISOString(), rooms: [], warnings: [],
  } }));
  await page.goto('/');
  const banner = page.getByRole('banner');
  const refresh = banner.getByRole('button', { name: 'Refresh', exact: true });
  await expect(refresh).toBeVisible();
  for (const width of [1280, 600, 599, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await expectRightAlignment(page, banner.getByRole('button', { name: accountName, exact: true }), refresh);
  }
  accountName = `${'long.account.'.repeat(12)}person@example.test`;
  await page.reload();
  const account = banner.getByRole('button', { name: accountName, exact: true });
  await expect(account).toBeVisible();
  await expectRightAlignment(page, account, refresh);
  expect(await account.locator('.MuiTypography-root').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await account.click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(refresh).toHaveCount(0);
  await expectRightAlignment(page, account);
});
