import { expect, test } from '@playwright/test';

const translationFile = (url: URL, language: string) =>
  new RegExp(`/${language}(?:-[^/]+)?\\.json$`).test(url.pathname)
  && !url.searchParams.has('import') && !url.searchParams.has('url');

async function openSettings(page: import('@playwright/test').Page) {
  await page.getByRole('banner').getByRole('button', { name: 'Demo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
}

test('login, rooms, device provenance, charts, languages and logout', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Every room. Every reading.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Soggiorno' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await expect(page.getByRole('region', { name: 'Soggiorno' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Home', exact: true })).toBeVisible();
  const living = page.getByRole('region', { name: 'Soggiorno' });
  await expect(living.getByRole('link').filter({ hasText: 'Soggiorno / Soggiorno' }).filter({ hasText: '21.7' })).toBeVisible();
  await expect(living.getByText('Temperature', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Camera' }).getByText('Stale data', { exact: true })).toHaveCount(3);
  await expect(page.getByRole('region', { name: 'Camera' }).getByRole('link').filter({ hasText: '20.2' })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
  if (test.info().project.name === 'mobile') {
    await expect(living.getByTestId('measurement-device').first()).toBeHidden();
    await expect(living.getByTestId('measurement-time').first()).toBeHidden();
    const cards = await living.getByTestId('measurement-grid').locator(':scope > *').all();
    const first = (await cards[0].boundingBox())!;
    const second = (await cards[1].boundingBox())!;
    const third = (await cards[2].boundingBox())!;
    expect(first.y).toBe(second.y);
    expect(second.x).toBeGreaterThan(first.x);
    expect(third.y).toBeGreaterThan(first.y);
  } else {
    await expect(living.getByTestId('measurement-device').first()).toBeVisible();
    await expect(living.getByTestId('measurement-time').first()).toBeVisible();
  }
  await expect(living.getByText('Absolute pressure', { exact: true })).toBeVisible();
  await expect(living.getByRole('link').filter({ hasText: 'Absolute pressure' })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('dashboard.png'), fullPage: true });
  await living.getByRole('link').filter({ hasText: 'Termostato' }).click();
  await expect(page).toHaveURL(/measurements/);
  await expect(page.getByRole('banner').getByRole('button', { name: 'Back', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '6 h', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (const range of [12, 24, 48]) {
    const response = page.waitForResponse(url => url.url().includes(`/history/`) && url.url().includes(`hours=${range}`));
    await page.getByRole('button', { name: `${range} h`, exact: true }).click();
    expect((await response).ok()).toBe(true);
  }
  await expect(page.locator('.MuiChartsSurface-root')).toBeVisible();
  await openSettings(page);
  await page.getByRole('radiogroup', { name: 'Appearance', exact: true }).getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(16, 27, 29)');
  await page.screenshot({ path: test.info().outputPath('settings-dark.png'), fullPage: true });
  await page.getByRole('radiogroup', { name: 'Language', exact: true }).getByRole('radio', { name: 'Italiano', exact: true }).click();
  await expect(page.getByRole('radiogroup', { name: 'Lingua', exact: true }).getByRole('radio', { name: 'Italiano', exact: true })).toBeChecked();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Impostazioni', exact: true })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(16, 27, 29)');
  await page.getByRole('button', { name: 'Indietro', exact: true }).click();
  await expect(page).toHaveURL(/measurements/);
  await page.getByRole('button', { name: 'Indietro', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Soggiorno' })).toBeVisible();
  const cookies = await context.cookies();
  expect(cookies.find(cookie => cookie.name === 'sh.session')?.httpOnly).toBe(true);
  await page.getByRole('banner').getByRole('button', { name: 'Demo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Esci', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Esplora la demo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Soggiorno' })).toHaveCount(0);
  expect((await page.request.get('/api/homes/')).status()).toBe(401);
  expect(errors).toEqual([]);
});

test('values become stale then unavailable on an open page without polling and layout fits the viewport', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await expect(page.getByRole('region', { name: 'Soggiorno' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Soggiorno' }).getByRole('link')
    .filter({ hasText: 'Soggiorno / Soggiorno' }).filter({ hasText: '21.7' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Soggiorno' }).getByText('Unavailable', { exact: true })).toHaveCount(0);
  let requests = 0;
  page.on('request', request => { if (request.url().includes('/api/homes')) requests++; });
  await page.clock.fastForward(31 * 60_000);
  await expect(page.getByRole('region', { name: 'Soggiorno' }).getByText('Stale data', { exact: true })).toHaveCount(9);
  await expect(page.getByRole('region', { name: 'Soggiorno' }).getByRole('link').filter({ hasText: '21.7' })).toBeVisible();
  await page.clock.fastForward(48 * 60 * 60_000);
  await expect(page.getByRole('region', { name: 'Soggiorno' }).getByText('Unavailable', { exact: true })).toHaveCount(9);
  expect(requests).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('translations load only when requested, use cached resources, and silently fall back to English', async ({ page }) => {
  const loaded: string[] = [];
  page.on('request', request => {
    if (translationFile(new URL(request.url()), '(?:en|it|fr|de|es|pt)')) loaded.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Explore the demo' })).toBeVisible();
  expect(loaded).toHaveLength(1);
  expect(loaded[0]).toMatch(/\/en(?:-[^/]+)?\.json/);
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await openSettings(page);
  await page.getByRole('radiogroup', { name: 'Language', exact: true }).getByRole('radio', { name: 'Italiano', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Impostazioni', exact: true })).toBeVisible();
  expect(loaded).toHaveLength(2);
  expect(loaded[1]).toMatch(/\/it(?:-[^/]+)?\.json/);
  await page.getByRole('radiogroup', { name: 'Lingua', exact: true }).getByRole('radio', { name: 'English', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  expect(loaded).toHaveLength(2);
  await page.route(url => translationFile(url, 'fr'), route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.getByRole('radiogroup', { name: 'Language', exact: true }).getByRole('radio', { name: 'Français', exact: true }).click();
  await expect(page.getByRole('radiogroup', { name: 'Language', exact: true }).getByRole('radio', { name: 'English', exact: true })).toBeChecked();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('smart-house.language'))).toBe('en');
  await expect(page.getByRole('alert')).toHaveCount(1);
});

test('an unavailable startup language falls back to English without showing translation keys', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('smart-house.language', 'it'));
  await page.route(url => translationFile(url, 'it'), route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Explore the demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await openSettings(page);
  await expect(page.getByRole('radiogroup', { name: 'Language', exact: true }).getByRole('radio', { name: 'English', exact: true })).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('smart-house.language'))).toBe('en');
});

test('English translation failure shows a recoverable bootstrap error', async ({ page }) => {
  let fail = true;
  await page.route(url => translationFile(url, 'en'), route =>
    fail ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.continue());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Unable to load translations');
  await expect(page.getByRole('button', { name: 'Explore the demo' })).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Riprova / Retry' }).click();
  await expect(page.getByRole('button', { name: 'Explore the demo' })).toBeVisible();
});

test('two-column compact cards apply below exactly 600px without horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  const living = page.getByRole('region', { name: 'Soggiorno' });
  await expect(living.getByRole('link').filter({ hasText: '21.7' })).toBeVisible();
  for (const width of [600, 599, 320]) {
    await page.setViewportSize({ width, height: 850 });
    if (width < 600) {
      await expect(living.getByTestId('measurement-device').first()).toBeHidden();
      await expect(living.getByTestId('measurement-time').first()).toBeHidden();
    } else {
      await expect(living.getByTestId('measurement-device').first()).toBeVisible();
      await expect(living.getByTestId('measurement-time').first()).toBeVisible();
    }
    const cards = living.getByTestId('measurement-grid').locator(':scope > *');
    const first = (await cards.nth(0).boundingBox())!;
    const second = (await cards.nth(1).boundingBox())!;
    const third = (await cards.nth(2).boundingBox())!;
    expect(first.y).toBe(second.y);
    expect(second.x).toBeGreaterThan(first.x);
    expect(third.y).toBeGreaterThan(first.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('API logging matches the build mode and never exposes session credentials', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', message => { if (message.type() === 'log') logs.push(message.text()); });
  const sessionResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/session'));
  await page.goto('/');
  const session = await (await sessionResponse).json();
  await expect(page.getByRole('button', { name: 'Explore the demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await expect(page.getByRole('region', { name: 'Soggiorno' })).toBeVisible();
  const development = await page.evaluate(async () => (await fetch('/@vite/client')).headers.get('content-type')?.includes('javascript') === true);
  const apiLogs = logs.filter(log => log.startsWith('API request') || log.startsWith('API response'));
  if (development) expect(apiLogs.length).toBeGreaterThan(0);
  else expect(apiLogs).toHaveLength(0);
  expect(apiLogs.join('\n')).not.toContain(session.csrfToken);
  expect(apiLogs.join('\n')).not.toMatch(/sh\.session|sh\.csrf/);
});
