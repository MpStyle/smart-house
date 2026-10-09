import { expect, test } from '@playwright/test';

test('login, rooms, device provenance, charts, languages and logout', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Every room. Every reading.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Soggiorno' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await expect(page.getByRole('heading', { name: 'Home overview' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Home', exact: true })).toBeVisible();
  const living = page.getByRole('region', { name: 'Soggiorno' });
  await expect(living.getByRole('link').filter({ hasText: 'Soggiorno / Soggiorno' }).filter({ hasText: '21.7' })).toBeVisible();
  await expect(living.getByText('Temperature', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Camera' }).getByText('Unavailable', { exact: true })).toHaveCount(3);
  await expect(living.getByText('Absolute pressure', { exact: true })).toBeVisible();
  await expect(living.getByRole('link').filter({ hasText: 'Absolute pressure' })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('dashboard.png'), fullPage: true });
  await living.getByRole('link').filter({ hasText: 'Termostato' }).click();
  await expect(page).toHaveURL(/measurements/);
  await expect(page.getByRole('button', { name: '6 h', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (const range of [12, 24, 48]) {
    const response = page.waitForResponse(url => url.url().includes(`/history/`) && url.url().includes(`hours=${range}`));
    await page.getByRole('button', { name: `${range} h`, exact: true }).click();
    expect((await response).ok()).toBe(true);
  }
  await expect(page.locator('.MuiChartsSurface-root')).toBeVisible();
  await page.getByRole('combobox', { name: 'Appearance', exact: true }).click();
  await page.getByRole('option', { name: 'Dark', exact: true }).click();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(16, 27, 29)');
  await page.screenshot({ path: test.info().outputPath('history-dark.png'), fullPage: true });
  await page.getByRole('combobox', { name: 'Language', exact: true }).click();
  await page.getByRole('option', { name: 'Italiano' }).click();
  await page.reload();
  await expect(page.getByText('Storico della misurazione', { exact: false })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(16, 27, 29)');
  await page.getByRole('link', { name: 'Torna alla dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'La tua casa, a colpo d’occhio' })).toBeVisible();
  const cookies = await context.cookies();
  expect(cookies.find(cookie => cookie.name === 'sh.session')?.httpOnly).toBe(true);
  await page.getByRole('button', { name: 'Esci', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Esplora la demo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Soggiorno' })).toHaveCount(0);
  expect((await page.request.get('/api/homes/')).status()).toBe(401);
  expect(errors).toEqual([]);
});

test('values expire on an open page without polling and layout fits the viewport', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await expect(page.getByRole('heading', { name: 'Home overview' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Soggiorno' }).getByRole('link')
    .filter({ hasText: 'Soggiorno / Soggiorno' }).filter({ hasText: '21.7' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Soggiorno' }).getByText('Unavailable', { exact: true })).toHaveCount(0);
  let requests = 0;
  page.on('request', request => { if (request.url().includes('/api/homes')) requests++; });
  await page.clock.fastForward(31 * 60_000);
  await expect(page.getByRole('region', { name: 'Soggiorno' }).getByText('Unavailable', { exact: true })).toHaveCount(9);
  expect(requests).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
