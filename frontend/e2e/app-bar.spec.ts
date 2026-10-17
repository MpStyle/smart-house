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
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: {
    authenticated: true, csrfToken: 'layout-test', authAvailable: true, demoAvailable: false, demo: false, expiresAt: null,
  } }));
  await page.route('**/api/v1/homes', route => route.fulfill({ json: {
    homes: [{ id: 'layout-home', name: 'Home', timezone: 'UTC' }], warnings: [], accountName,
  } }));
  await page.route('**/api/v1/homes/layout-home/measurements', route => route.fulfill({ json: {
    homeId: 'layout-home', timezone: 'UTC', fetchedAt: new Date().toISOString(), rooms: [], warnings: [],
  } }));
  await page.goto('/');
  const banner = page.getByRole('banner');
  const refresh = banner.getByRole('button', { name: 'Refresh', exact: true });
  await expect(refresh).toBeVisible();
  for (const width of [1280, 900, 768, 700, 600, 599, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    const account = banner.getByRole('button', { name: accountName, exact: true });
    await expect(account).toHaveAttribute('title', accountName);
    await expectRightAlignment(page, account, refresh);
    if (width < 900) {
      await expect(account.getByTestId('PersonOutlineIcon')).toBeVisible();
      await expect(account.locator('.MuiTypography-root')).toBeHidden();
      await expect(account.getByTestId('ExpandMoreIcon')).toBeHidden();
      const bounds = (await account.boundingBox())!;
      expect(bounds.width).toBe(44);
      expect(bounds.height).toBe(44);
    } else {
      await expect(account.getByTestId('PersonOutlineIcon')).toBeHidden();
      await expect(account.locator('.MuiTypography-root')).toBeVisible();
      await expect(account.getByTestId('ExpandMoreIcon')).toBeVisible();
    }
  }
  accountName = `${'long.account.'.repeat(12)}person@example.test`;
  await page.reload();
  const account = banner.getByRole('button', { name: accountName, exact: true });
  await expect(account).toBeVisible();
  await expect(account).toHaveAttribute('title', accountName);
  await expectRightAlignment(page, account, refresh);
  await expect(account.getByTestId('PersonOutlineIcon')).toBeVisible();
  await account.click();
  await expect(page.getByRole('menu', { name: accountName, exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Sign out', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 600, height: 850 });
  await expect(account.locator('.MuiTypography-root')).toBeHidden();
  await expectRightAlignment(page, account, refresh);
  await page.setViewportSize({ width: 1280, height: 850 });
  await expect(account.locator('.MuiTypography-root')).toBeVisible();
  await expectRightAlignment(page, account, refresh);
  expect(await account.locator('.MuiTypography-root').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 599, height: 850 });
  await expect(account.getByTestId('PersonOutlineIcon')).toBeVisible();
  await account.click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await expect(refresh).toHaveCount(0);
  await expectRightAlignment(page, account);
  await expect(account.getByTestId('PersonOutlineIcon')).toBeVisible();
});
