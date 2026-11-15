import { expect, test } from '@playwright/test';

/**
 * Full account flow in the browser: register → confirmation e-mail (Mailpit) → sign in → save a
 * place → see it in "My places" → sign out. Skipped where accounts are not enabled (no database)
 * or no Mailpit is running (CI).
 */
const MAILPIT = 'http://127.0.0.1:8025';

test('register, confirm by e-mail, sign in and save a place', async ({ page, request }) => {
  const me = await (await request.get('/api/auth/me')).json();
  const mailpit = await request.get(`${MAILPIT}/api/v1/info`).catch(() => null);
  test.skip(!me.accounts || !mailpit?.ok(), 'accounts or Mailpit not available here');

  const email = `e2e${Date.now()}@example.org`;
  const password = 'correct horse battery';

  await page.goto('/account');
  await page.getByRole('tab', { name: 'Create account' }).click();
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Check your inbox')).toBeVisible();

  // The confirmation link from the e-mail.
  let link = '';
  await expect
    .poll(async () => {
      const found = await (await request.get(`${MAILPIT}/api/v1/search?query=to:${email}`)).json();
      const id = found.messages?.[0]?.ID;
      if (!id) return '';
      const msg = await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json();
      link = (/https?:\/\/\S+/.exec(msg.Text) ?? [''])[0];
      return link;
    })
    .toContain('/api/auth/verify?token=');
  await page.goto(new URL(link).pathname + new URL(link).search);
  await expect(page.getByText('E-mail confirmed')).toBeVisible();

  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).last().click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

  await page.goto('/r/ZZB');
  await page.getByRole('button', { name: 'Save place' }).click();
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();

  await page.goto('/account');
  await expect(page.getByRole('link', { name: /Mock Region/ })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('tab', { name: 'Sign in' })).toBeVisible();
});
