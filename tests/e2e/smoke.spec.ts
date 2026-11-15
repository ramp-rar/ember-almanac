import { expect, test } from '@playwright/test';

test('health endpoint reports status and never crashes', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(['ok', 'degraded']).toContain(body.status);
  expect(body.db).toHaveProperty('configured');
  expect(body).toHaveProperty('dataset_version');
});

test('meta endpoint returns dataset dates or a readable 503', async ({ request }) => {
  const res = await request.get('/api/meta');
  expect([200, 503]).toContain(res.status());
  const body = await res.json();
  if (res.status() === 200) {
    expect(body.meta.coverage.MODIS.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.is_mock).toBe(body.dataset_version.startsWith('mock-'));
  } else {
    expect(body.message).toBeTruthy();
  }
});

test('home shows the calendar, explains all five statuses and flags mock data', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page.getByRole('grid')).toBeVisible();
  const legend = page.getByLabel('Legend');
  for (const label of [
    'final —',
    'estimate —',
    'preliminary —',
    'no data —',
    'not yet observed —',
  ]) {
    await expect(legend.getByText(label)).toBeVisible();
  }
  const meta = await request.get('/api/meta');
  if (meta.status() === 200 && (await meta.json()).is_mock) {
    await expect(page.getByTestId('dataset-banner')).toContainText('MOCK DATA');
  }
  // No horizontal scroll at any viewport.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test('head scripts run: theme and language are set before the app loads', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/);
  await expect(page.locator('html')).toHaveAttribute('data-lang', /^(en|ru|tg)$/);
  expect(errors).toEqual([]);
});

test('language switch translates the page and is remembered', async ({ page }) => {
  await page.goto('/r/ZZB');
  await page.getByRole('radio', { name: 'Русский' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('heading', { name: /Календарь пожаров/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /Календарь пожаров/ })).toBeVisible();
  await page.getByRole('radio', { name: 'Тоҷикӣ' }).click();
  await expect(page.getByRole('heading', { name: /Тақвими сӯхтор/ })).toBeVisible();
});
