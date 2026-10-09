import { expect, test } from '@playwright/test';

test('language flags are local SVGs to the left of accessible names, fit mobile and select the language when clicked', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({ json: {
    authenticated: true, csrfToken: 'flag-test', authAvailable: true, demoAvailable: false, demo: false, expiresAt: null,
  } }));
  await page.route('**/api/homes/', route => route.fulfill({ json: { homes: [], warnings: [] } }));
  await page.goto('/#/settings');
  const names = ['English', 'Italiano', 'Français', 'Deutsch', 'Español', 'Português'];
  await expect(page.getByRole('radiogroup', { name: 'Language', exact: true })).toBeVisible();
  for (const name of names) {
    const label = page.locator('label').filter({ has: page.getByRole('radio', { name, exact: true }) });
    const flag = label.locator('img');
    await expect(flag).toBeVisible();
    await expect(flag).toHaveAttribute('alt', '');
    await expect(flag).toHaveAttribute('aria-hidden', 'true');
    await expect.poll(() => flag.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    const format = await flag.evaluate(async (image: HTMLImageElement) => {
      const response = await fetch(image.currentSrc);
      return { type: response.headers.get('content-type'), svg: (await response.text()).trimStart().startsWith('<svg') };
    });
    expect(format.type).toContain('image/svg+xml');
    expect(format.svg).toBe(true);
    const source = await flag.getAttribute('src');
    expect(source?.startsWith('data:image/svg+xml,') || new URL(source!, page.url()).origin === new URL(page.url()).origin).toBe(true);
    const bounds = (await flag.boundingBox())!;
    const text = (await label.getByText(name, { exact: true }).boundingBox())!;
    expect(bounds.width).toBe(24);
    expect(bounds.height).toBe(18);
    expect(bounds.x + bounds.width).toBeLessThan(text.x);
  }
  await expect(page.getByRole('img')).toHaveCount(0);
  const radios = page.getByRole('radiogroup', { name: 'Language', exact: true }).getByRole('radio');
  for (const width of [600, 599, 320]) {
    await page.setViewportSize({ width, height: 850 });
    const first = (await radios.nth(0).boundingBox())!;
    const second = (await radios.nth(1).boundingBox())!;
    if (width < 600) expect(second.y).toBeGreaterThan(first.y);
    else expect(second.y).toBe(first.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  const portuguese = page.locator('label').filter({ has: page.getByRole('radio', { name: 'Português', exact: true }) });
  await portuguese.locator('img').click();
  await expect(page.getByRole('radio', { name: 'Português', exact: true })).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('smart-house.language'))).toBe('pt');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt');
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Português', exact: true })).toBeChecked();
  await expect(page.locator('img')).toHaveCount(6);
});
