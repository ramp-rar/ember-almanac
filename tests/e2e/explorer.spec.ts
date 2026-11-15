import { expect, test } from '@playwright/test';

test.describe('Burning calendar (home screen)', () => {
  test('home opens a region calendar with honest statuses', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/r\/[A-Z]{3}/);
    const grid = page.getByRole('grid');
    await expect(grid).toBeVisible();
    await expect(page.getByRole('gridcell')).toHaveCount(27 * 12);

    // 2000 Jan–Oct are no data, never zero; next month is a future month.
    await expect(page.locator('#cell-2000-3')).toHaveAttribute('aria-label', 'March 2000: no data');
    await expect(page.locator('#cell-2026-12')).toHaveAttribute(
      'aria-label',
      'December 2026: not yet observed',
    );
    await expect(page.locator('#cell-2026-11')).toHaveAttribute(
      'aria-label',
      /of 30 days observed/,
    );

    // Default headline: last complete month, with its status.
    await expect(page.getByRole('region', { name: 'Selected month' })).toContainText(
      'October 2026',
    );
    await expect(page.getByRole('region', { name: 'Selected month' })).toContainText(
      /vs median of \d+ Octobers/,
    );
  });

  test('clicking a month pins it in the headline and the URL', async ({ page }) => {
    await page.goto('/r/ZZB');
    await page.locator('#cell-2015-8 rect').first().click();
    await expect(page).toHaveURL(/y=2015&m=8/);
    await expect(page.getByRole('region', { name: 'Selected month' })).toContainText('August 2015');

    // The shared URL restores the same state.
    await page.reload();
    await expect(page.getByRole('region', { name: 'Selected month' })).toContainText('August 2015');
  });

  test('keyboard: arrows move, Enter pins', async ({ page }) => {
    await page.goto('/r/ZZB?y=2015&m=8');
    await page.getByRole('grid').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/y=2015&m=9/);
  });

  test('colour modes switch without losing the selection', async ({ page }) => {
    await page.goto('/r/ZZB?y=2015&m=8');
    await page.getByRole('radio', { name: 'Ratio to median' }).click();
    await expect(page).toHaveURL(/mode=ratio/);
    await expect(page.getByText('ratio to median of the same month')).toBeVisible();
    await page.getByRole('radio', { name: 'Raw detections' }).click();
    await expect(page.getByText(/Raw counts jump when VIIRS starts/)).toBeVisible();
  });
});

test.describe('Area of interest', () => {
  test('invalid coordinates give readable errors', async ({ page }) => {
    await page.goto('/r/ZZB');
    await page.getByRole('tab', { name: 'Coordinates' }).click();
    await page.getByLabel('Latitude').fill('95');
    await page.getByRole('button', { name: 'Show calendar' }).click();
    await expect(
      page.getByRole('region', { name: 'Area of interest' }).getByRole('alert'),
    ).toContainText('Latitude must be between');
  });

  test('a point with radius opens a shareable area calendar', async ({ page }) => {
    await page.goto('/r/ZZB');
    await page.getByRole('tab', { name: 'Coordinates' }).click();
    await page.getByLabel('Latitude').fill('45');
    await page.getByLabel('Longitude').fill('70');
    await page.getByLabel('Radius, km').fill('150');
    await page.getByRole('button', { name: 'Show calendar' }).click();
    await page.waitForURL(/\/a\/pt_45_70_150/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('150 km around 45°, 70°');
    await expect(page.getByRole('grid')).toBeVisible();
  });

  test('an area without fire says so instead of an empty screen', async ({ page }) => {
    await page.goto('/a/pt_-40_-30_20');
    await expect(page.getByText('No fire observations in this area.')).toBeVisible();
  });
});

test('summary.csv: every row has a status and no data is never 0', async ({ request }) => {
  const res = await request.get('/api/export/summary?aoi=r:ZZB');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/csv');
  const [header, ...rows] = (await res.text()).trim().split('\n');
  const cols = header!.split(',');
  expect(cols).toEqual(
    expect.arrayContaining([
      'year',
      'month',
      'harmonized',
      'ratio_to_median',
      'percentile',
      'status',
    ]),
  );
  const at = (row: string, col: string) => row.split(',')[cols.indexOf(col)];
  const march2000 = rows.find((r) => r.startsWith('2000,3,'))!;
  expect(at(march2000, 'status')).toBe('no_data');
  expect(at(march2000, 'harmonized')).toBe('');
  for (const row of rows)
    expect(at(row, 'status')).toMatch(/^(final|estimate|preliminary|no_data)$/);
});
