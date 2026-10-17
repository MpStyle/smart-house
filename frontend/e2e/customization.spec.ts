import { expect, test, type Page } from '@playwright/test';

const home = { id: 'custom-home', name: `A very long home name ${'with more words '.repeat(8)}`, timezone: 'UTC' };
const measuredAt = new Date().toISOString();
const reading = { id: 'a', kind: 'temperature', deviceName: 'Sensor A', value: 21, unit: '°C', measuredAt,
  hasHistory: true, updateFailed: false, status: 'fresh', sampleMinutes: null };
const room = { id: 'living:room', name: 'Living', measurements: [
  reading, { ...reading, id: 'static', kind: 'absolutePressure', hasHistory: false, unit: 'mbar' },
  { ...reading, id: 'b', kind: 'humidity', deviceName: 'Sensor B', unit: '%' },
] };

async function mockHome(page: Page) {
  await page.route('**/api/v1/auth/session', route => route.fulfill({ json: {
    authenticated: true, csrfToken: 'test', authAvailable: true, demoAvailable: false, demo: false, expiresAt: null,
  } }));
  await page.route('**/api/v1/homes', route => route.fulfill({ json: { homes: [home], warnings: [], accountName: 'Person' } }));
  await page.route('**/api/v1/homes/*/measurements', route => route.fulfill({ json: {
    homeId: home.id, timezone: home.timezone, fetchedAt: measuredAt, rooms: [room], warnings: [],
  } }));
  await page.route('**/api/v1/homes/*/history/*', route => {
    const url = new URL(route.request().url());
    const hours = Number(url.searchParams.get('hours') ?? 6);
    const to = new Date(measuredAt);
    const from = new Date(to.getTime() - hours * 3600_000);
    return route.fulfill({ json: {
      measurementId: url.pathname.split('/').at(-1), unit: '°C', from: from.toISOString(), to: to.toISOString(),
      points: [{ time: from.toISOString(), value: 20 }, { time: measuredAt, value: 21 }],
    } });
  });
}

async function settings(page: Page) {
  await page.getByRole('banner').getByRole('button', { name: 'Person', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
}

test('room cards precede ordered charts, ranges work, and individual measurement links remain', async ({ page }) => {
  await mockHome(page);
  await page.addInitScript(({ id, roomId }) => localStorage.setItem('smart-house.dashboardOrders', JSON.stringify({
    [id]: { roomIds: [], measurementIds: { [roomId]: ['b', 'static', 'a'] } },
  })), { id: home.id, roomId: room.id });
  await page.goto('/');
  await page.getByRole('heading', { name: 'Living' }).getByRole('link').click();
  await expect(page).toHaveURL(/rooms\/living%3Aroom/);
  await expect(page.getByRole('heading', { level: 1, name: 'Living' })).toBeVisible();
  await expect(page.getByTestId('room-readings')).toContainText('Absolute pressure');
  const charts = page.getByRole('region');
  await expect(charts).toHaveCount(2);
  await expect(charts.nth(0)).toHaveAttribute('aria-label', 'Humidity · Sensor B');
  await expect(charts.nth(1)).toHaveAttribute('aria-label', 'Temperature · Sensor A');
  await expect(page.locator('.MuiChartsSurface-root')).toHaveCount(2);
  const cardsBounds = (await page.getByTestId('room-readings').boundingBox())!;
  const chartBounds = (await charts.nth(0).boundingBox())!;
  expect(chartBounds.y).toBeGreaterThan(cardsBounds.y + cardsBounds.height);
  const responses = [
    page.waitForResponse(response => response.url().includes('/history/a?hours=24')),
    page.waitForResponse(response => response.url().includes('/history/b?hours=24')),
  ];
  await page.getByRole('button', { name: '24 h', exact: true }).click();
  for (const response of await Promise.all(responses)) expect(response.ok()).toBe(true);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('link', { name: 'Temperature · Sensor A', exact: true }).click();
  await expect(page).toHaveURL(/measurements\/a/);
  await expect(page.locator('.MuiChartsSurface-root')).toHaveCount(1);
});

test('hidden rooms and readings survive reload, remain editable, and support a cards-only detail', async ({ page }) => {
  await mockHome(page);
  await page.goto('/');
  await settings(page);
  const custom = page.getByRole('region', { name: 'Customize Living', exact: true });
  await custom.getByRole('switch', { name: 'Show reading: Temperature · Sensor A', exact: true }).uncheck();
  await custom.getByRole('switch', { name: 'Show reading: Humidity · Sensor B', exact: true }).uncheck();
  await page.reload();
  await expect(custom.getByRole('switch', { name: 'Show reading: Humidity · Sensor B', exact: true })).not.toBeChecked();
  await page.getByRole('banner').getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('heading', { name: 'Living' }).getByRole('link').click();
  await expect(page.getByText('Absolute pressure', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Time range' })).toHaveCount(0);
  await settings(page);
  await custom.getByRole('switch', { name: 'Show room: Living', exact: true }).uncheck();
  await expect(custom.getByRole('switch', { name: 'Show room: Living', exact: true })).toBeVisible();
  await page.goto('/#/');
  await expect(page.getByText('All readings are hidden. You can show them again in Settings.')).toBeVisible();
  await settings(page);
  await custom.getByRole('switch', { name: 'Show room: Living', exact: true }).check();
  await custom.getByRole('switch', { name: 'Show reading: Absolute pressure · Sensor A', exact: true }).uncheck();
  await page.goto('/#/');
  await expect(page.getByRole('region', { name: 'Living' })).toHaveCount(0);
  await expect(page.getByText('All readings are hidden. You can show them again in Settings.')).toBeVisible();
});

test('built-in and uploaded icons persist, resize precisely, reset and reject invalid files', async ({ page }) => {
  await mockHome(page);
  await page.goto('/');
  await settings(page);
  const custom = page.getByRole('region', { name: 'Customize Living', exact: true });
  await custom.getByRole('group', { name: 'Icon for room: Living', exact: true }).getByRole('button', { name: 'Garden', exact: true }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#228866';
    context.fillRect(0, 0, 512, 256);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const upload = page.getByLabel(`Upload image for Icon for home: ${home.name}`, { exact: true });
  await upload.setInputFiles({ name: 'home.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('smart-house.dashboardCustomizations')!)['custom-home'].icon?.kind)).toBe('image');
  const dimensions = await page.evaluate(async () => {
    const icon = JSON.parse(localStorage.getItem('smart-house.dashboardCustomizations')!)['custom-home'].icon;
    const image = new Image(); image.src = icon.data; await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight, bytes: atob(icon.data.split(',')[1]).length };
  });
  expect(dimensions.width).toBe(128);
  expect(dimensions.height).toBe(64);
  expect(dimensions.bytes).toBeLessThanOrEqual(64 * 1024);
  await page.reload();
  await expect(page.getByRole('banner').getByRole('combobox').locator('img')).toBeVisible();
  await upload.setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert')).toContainText('Could not use this image');
  await expect(page.getByRole('banner').getByRole('combobox').locator('img')).toBeVisible();
  await upload.setInputFiles({ name: 'corrupt.png', mimeType: 'image/png', buffer: Buffer.from('not a png') });
  await expect(page.getByRole('alert')).toContainText('Could not use this image');
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Living' }).getByTestId('YardOutlinedIcon')).toBeVisible();
  await page.getByRole('heading', { name: 'Living' }).getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Living' }).locator('..').getByTestId('YardOutlinedIcon')).toBeVisible();
  await settings(page);
  const homePicker = page.getByText(`Icon for home: ${home.name}`, { exact: true }).locator('../..');
  await homePicker.getByRole('button', { name: 'Reset icon', exact: true }).click();
  await expect(page.getByRole('banner').getByRole('combobox').locator('img')).toHaveCount(0);
});

test('demo app bar stays one line, back fits on mobile and scroll direction controls visibility', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await expect(page.getByRole('region', { name: 'Soggiorno', exact: true })).toBeVisible();
  for (const width of [320, 600, 640, 700, 768]) {
    await page.setViewportSize({ width, height: 850 });
    const selector = (await page.getByRole('combobox', { name: 'Home', exact: true }).boundingBox())!;
    const refresh = (await page.getByRole('button', { name: 'Refresh', exact: true }).boundingBox())!;
    const account = (await page.getByRole('banner').getByRole('button', { name: 'Demo', exact: true }).boundingBox())!;
    expect(Math.abs(selector.y + selector.height / 2 - refresh.y - refresh.height / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(refresh.y + refresh.height / 2 - account.y - account.height / 2)).toBeLessThanOrEqual(2);
    expect(selector.x + selector.width).toBeLessThanOrEqual(refresh.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 850 });
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(page.getByRole('banner')).toHaveAttribute('data-hidden', 'true');
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect(page.getByRole('banner')).toHaveAttribute('data-hidden', 'false');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('banner').getByRole('button', { name: 'Demo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  for (const width of [320, 600, 768]) {
    await page.setViewportSize({ width, height: 850 });
    await expect(page.getByRole('banner').getByRole('button', { name: 'Back', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('demo dashboard documentation screenshot uses only simulated data', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.addInitScript(() => {
    localStorage.setItem('smart-house.theme', 'light');
    localStorage.setItem('smart-house.dashboardOrders', JSON.stringify({
      'demo-home': { roomIds: ['SOGGIORNO', 'CAMERA', 'GIARDINO'], measurementIds: {} },
    }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await expect(page.getByText('Demonstration with simulated data. No real devices are connected.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Soggiorno', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Demo', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('demo-dashboard.png'), fullPage: false });
});
