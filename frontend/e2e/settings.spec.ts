import { expect, test, type Locator, type Page } from '@playwright/test';

async function openSettings(page: Page) {
  await page.getByRole('banner').getByRole('button', { name: 'Demo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
}

async function drag(page: Page, source: Locator, target: Locator, touch: boolean) {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  if (touch) {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
    for (let step = 1; step <= 12; step++)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ id: 1, x: start.x + (end.x - start.x) * step / 12, y: start.y + (end.y - start.y) * step / 12 }],
      });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
  }
}

test('account menu owns settings and logout; language and theme live in settings and survive reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('radiogroup', { name: 'Language' })).toHaveCount(0);
  await expect(page.getByRole('radiogroup', { name: 'Appearance' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await expect(page.getByRole('region', { name: 'Soggiorno' })).toBeVisible();
  await expect(page.getByRole('menuitem')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
  await openSettings(page);
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.getByRole('menu')).toHaveCount(0);
  const banner = page.getByRole('banner');
  await expect(banner.getByRole('button', { name: 'Back' })).toBeVisible();
  await expect(banner.getByRole('radiogroup', { name: 'Language' })).toHaveCount(0);
  await expect(banner.getByRole('button', { name: 'Refresh' })).toHaveCount(0);
  const language = page.getByRole('region', { name: 'Language', exact: true });
  const appearance = page.getByRole('region', { name: 'Appearance', exact: true });
  await expect(language.getByRole('radio')).toHaveCount(6);
  await expect(appearance.getByRole('radio')).toHaveCount(3);
  await expect(page.getByRole('combobox', { name: /Language|Appearance/ })).toHaveCount(0);
  const languageBounds = (await language.boundingBox())!;
  const appearanceBounds = (await appearance.boundingBox())!;
  expect(appearanceBounds.y).toBeGreaterThanOrEqual(languageBounds.y + languageBounds.height);
  const radios = language.getByRole('radio');
  const first = (await radios.nth(0).boundingBox())!;
  const second = (await radios.nth(1).boundingBox())!;
  if (test.info().project.name === 'mobile') {
    expect(second.y).toBeGreaterThan(first.y);
    expect(second.x).toBe(first.x);
  } else {
    expect(second.y).toBe(first.y);
    expect(second.x).toBeGreaterThan(first.x);
  }
  await appearance.getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(16, 27, 29)');
  await language.getByRole('radio', { name: 'Italiano', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Impostazioni' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('radiogroup', { name: 'Lingua' }).getByRole('radio', { name: 'Italiano', exact: true })).toBeChecked();
  await expect(page.getByRole('radiogroup', { name: 'Aspetto' }).getByRole('radio', { name: 'Scuro', exact: true })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await banner.getByRole('button', { name: 'Indietro' }).click();
  await expect(page.getByRole('region', { name: 'Soggiorno' })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Lingua' })).toHaveCount(0);
  await banner.getByRole('button', { name: 'Demo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Esci' }).click();
  await expect(page.getByRole('button', { name: 'Esplora la demo' })).toBeVisible();
  expect((await page.request.get('/api/homes/')).status()).toBe(401);
});

test('mouse and touch reorder rooms and measurements, persist them and update the dashboard', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await openSettings(page);
  const rooms = page.getByRole('list', { name: 'Room order', exact: true });
  await expect(rooms.getByRole('listitem')).toHaveText(['Camera', 'Giardino', 'Soggiorno']);
  await drag(page, rooms.getByRole('button', { name: 'Reorder Soggiorno' }), rooms.getByRole('button', { name: 'Reorder Camera' }), info.project.name === 'mobile');
  await expect(rooms.getByRole('listitem')).toHaveText(['Soggiorno', 'Camera', 'Giardino']);
  const readings = page.getByRole('list', { name: 'Readings in Soggiorno', exact: true });
  await drag(page, readings.getByRole('button', { name: 'Reorder Humidity - Soggiorno / Soggiorno', exact: true }),
    readings.getByRole('button', { name: 'Reorder Temperature - Soggiorno / Soggiorno', exact: true }), info.project.name === 'mobile');
  await expect(readings.getByRole('listitem').first()).toContainText('Humidity');
  await page.reload();
  await expect(rooms.getByRole('listitem')).toHaveText(['Soggiorno', 'Camera', 'Giardino']);
  await expect(readings.getByRole('listitem').first()).toContainText('Humidity');
  await page.getByRole('banner').getByRole('button', { name: 'Back', exact: true }).click();
  await expect.poll(() => page.getByRole('region').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label'))))
    .toEqual(['Soggiorno', 'Camera', 'Giardino']);
  await expect(page.getByRole('region', { name: 'Soggiorno' }).getByTestId('measurement-grid').locator(':scope > *').first()).toContainText('Humidity');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('keyboard sorting supports cancellation and isolates saved orders when switching homes', async ({ page }) => {
  await page.route('**/api/homes/', async route => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ response, json: { ...data, homes: [...data.homes, { ...data.homes[0], id: 'second-home', name: 'Second home' }] } });
  });
  await page.route('**/api/homes/second-home/measurements', async route => {
    const data = await (await page.request.get('/api/homes/demo-home/measurements')).json();
    await route.fulfill({ json: { ...data, homeId: 'second-home' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await openSettings(page);
  const rooms = page.getByRole('list', { name: 'Room order', exact: true });
  const camera = rooms.getByRole('button', { name: 'Reorder Camera' });
  await camera.focus();
  await page.keyboard.press('Space');
  await expect(camera).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('status').filter({ hasText: 'Camera is at position 2 of 3.' })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(camera).not.toHaveAttribute('aria-pressed', 'true');
  await expect(rooms.getByRole('listitem')).toHaveText(['Camera', 'Giardino', 'Soggiorno']);
  expect(await page.evaluate(() => localStorage.getItem('smart-house.dashboardOrders'))).toBeNull();
  await camera.focus();
  await page.keyboard.press('Space');
  await expect(camera).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('status').filter({ hasText: 'Camera is at position 2 of 3.' })).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(rooms.getByRole('listitem')).toHaveText(['Giardino', 'Camera', 'Soggiorno']);
  await page.getByRole('combobox', { name: 'Home', exact: true }).click();
  await page.getByRole('option', { name: 'Second home', exact: true }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(rooms.getByRole('listitem')).toHaveText(['Camera', 'Giardino', 'Soggiorno']);
  await page.getByRole('combobox', { name: 'Home', exact: true }).click();
  await page.getByRole('option', { name: 'Casa Netatmo', exact: true }).click();
  await expect(rooms.getByRole('listitem')).toHaveText(['Giardino', 'Camera', 'Soggiorno']);
});

test('settings remains available with no homes and on home discovery failure', async ({ page }) => {
  let fail = false;
  await page.route('**/api/homes/', route => route.fulfill(fail
    ? { status: 502, json: { code: 'provider_unavailable' } }
    : { json: { homes: [], warnings: [] } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await openSettings(page);
  await expect(page.getByRole('radiogroup', { name: 'Language' })).toBeVisible();
  await expect(page.getByRole('list')).toHaveCount(0);
  fail = true;
  await page.reload();
  await expect(page.getByRole('radiogroup', { name: 'Appearance' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.getByRole('banner').getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === '/' && (url.hash === '' || url.hash === '#/'));
});

test('real accounts display provider identity and retain access to the menu during snapshot failure', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({ json: {
    authenticated: true, csrfToken: 'test-csrf', authAvailable: true, demoAvailable: false, demo: false, expiresAt: null,
  } }));
  await page.route('**/api/homes/', route => route.fulfill({ json: {
    homes: [{ id: 'home', name: 'Home', timezone: 'UTC' }], warnings: [], accountName: 'person@example.test',
  } }));
  await page.route('**/api/homes/home/measurements', route => route.fulfill({ status: 502, json: { code: 'provider_unavailable' } }));
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'person@example.test', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Settings', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Sign out', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('banner').getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('banner').getByTestId('HomeOutlinedIcon')).toBeVisible();
});
