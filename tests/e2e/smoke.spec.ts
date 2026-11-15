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

test('home page renders, explains all five statuses and flags mock data', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('FIRE');
  for (const status of ['final', 'estimate', 'preliminary', 'no_data', 'future']) {
    await expect(page.getByText(status, { exact: true })).toBeVisible();
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
