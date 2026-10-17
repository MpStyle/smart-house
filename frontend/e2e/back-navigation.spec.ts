import { expect, test } from '@playwright/test';

const historyPath = '/#/homes/demo-home/measurements/thermostat%3ATemperature';

test('back replaces the home icon and returns within the app after reload', async ({ page }) => {
  await page.goto('/');
  const banner = page.getByRole('banner');
  await expect(banner.getByTestId('HomeOutlinedIcon')).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await expect(banner.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
  await page.getByRole('region', { name: 'Soggiorno' }).getByRole('link').filter({ hasText: 'Termostato' }).click();
  await expect(banner.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
  await expect(banner.getByTestId('HomeOutlinedIcon')).toHaveCount(0);
  await expect(banner.getByTestId('ArrowBackIcon')).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Refresh', exact: true })).toHaveCount(0);
  await expect(banner.getByRole('link', { name: /Back/ })).toHaveCount(0);
  await page.reload();
  await banner.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Soggiorno' })).toBeVisible();
  await expect(banner.getByTestId('HomeOutlinedIcon')).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
  await expect(banner.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
});

test('direct history entry keeps back available during loading and failure, then falls back to dashboard', async ({ page }) => {
  const session = await (await page.request.get('/api/v1/auth/session')).json();
  const login = await page.request.post('/api/v1/auth/demo', { headers: { 'X-CSRF-TOKEN': session.csrfToken } });
  expect(login.ok()).toBe(true);
  let finishLoading: () => void = () => {};
  const pending = new Promise<void>(resolve => { finishLoading = resolve; });
  await page.route('**/api/v1/homes/demo-home/measurements', async route => {
    await pending;
    await route.fulfill({ status: 502, json: { code: 'provider_unavailable' } });
  });
  await page.goto(historyPath);
  const back = page.getByRole('banner').getByRole('button', { name: 'Back', exact: true });
  await expect(back).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading your home…' })).toBeVisible();
  finishLoading();
  await expect(page.getByRole('alert').filter({ hasText: 'Could not retrieve the data' })).toBeVisible();
  await expect(back).toBeVisible();
  await page.unroute('**/api/v1/homes/demo-home/measurements');
  await back.click();
  await expect(page).not.toHaveURL(/measurements/);
  await expect(page.getByRole('region', { name: 'Soggiorno' })).toBeVisible();
  await expect(page.getByRole('banner').getByTestId('HomeOutlinedIcon')).toBeVisible();
});

test('an entry from outside router navigation uses the dashboard instead of leaving the app', async ({ page }) => {
  const session = await (await page.request.get('/api/v1/auth/session')).json();
  await page.request.post('/api/v1/auth/demo', { headers: { 'X-CSRF-TOKEN': session.csrfToken } });
  await page.goto('/outside-navigation');
  await page.goto(historyPath);
  await page.getByRole('banner').getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Soggiorno' })).toBeVisible();
  await expect(page).not.toHaveURL(/outside-navigation/);
});
