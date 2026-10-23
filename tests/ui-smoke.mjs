import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = Number(process.env.UI_TEST_PORT || 3123);
const base = `http://127.0.0.1:${port}`;
const screenshots = process.env.UI_ARTIFACT_DIR || '.next/ui-artifacts';
const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
  env: { ...process.env, RATE_LIMIT_BACKEND: 'memory', REVIEW_REPOSITORY: process.env.REVIEW_REPOSITORY || 'memory', IP_HASH_SECRET: process.env.IP_HASH_SECRET || 'ui-test-local-secret-only' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
app.stdout.on('data', chunk => { logs = (logs + chunk).slice(-12000); });
app.stderr.on('data', chunk => { logs = (logs + chunk).slice(-12000); });
let browser;

async function noOverflow(page) {
  const details = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, width: document.documentElement.scrollWidth, viewport: innerWidth, nodes: [...document.querySelectorAll('main, section, article, .qrPerformanceKpis, .qrPerformanceKpi')].map(el => ({ className: el.className, width: el.getBoundingClientRect().width })).filter(el => el.width > innerWidth) }));
  assert.equal(details.overflow, false, `Horizontal overflow on ${page.url()}: ${JSON.stringify(details)}`);
}

try {
  await mkdir(screenshots, { recursive: true });
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* waiting for app startup */ }
    if (app.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(ready, true, logs);
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width <= 390 ? 700 : 1000 });
    await page.goto(base);
    await page.getByRole('heading', { name: 'Mangal Traders', exact: true }).waitFor();
    await noOverflow(page);
    assert.equal(await page.getByRole('button', { name: 'Generate my review' }).count(), 0);
    assert.equal(await page.locator('.detailFields').count(), 0);
    assert.equal(await page.getByRole('button', { name: '1 star', exact: true }).isDisabled(), false);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${screenshots}/customer-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${screenshots}/customer-mobile.png`, fullPage: true });
  for (let rating = 1; rating <= 5; rating++) {
    await page.getByRole('button', { name: `${rating} star${rating === 1 ? '' : 's'}`, exact: true }).click();
    const review = page.getByRole('textbox', { name: 'Generated review' });
    await review.waitFor();
    assert.equal(await page.getByRole('button', { name: 'Copy & open Google review' }).isDisabled(), false, 'Google handoff must be available for every rating');
    assert.match(await review.inputValue(), /Mangal Traders/);
    if (rating === 1) {
      await review.fill('');
      assert.equal(await page.getByRole('button', { name: 'Copy & open Google review' }).isDisabled(), true);
      await review.fill('My own edited review.');
      await page.getByRole('button', { name: 'Copy only' }).click();
      await page.getByRole('status').filter({ hasText: 'Review copied' }).waitFor();
      await page.screenshot({ path: `${screenshots}/customer-review.png`, fullPage: true });
    }
    await page.getByRole('button', { name: 'Change rating' }).click();
    await page.getByRole('heading', { name: 'How was your experience?' }).waitFor();
    await noOverflow(page);
  }
  await page.screenshot({ path: `${screenshots}/customer-details.png`, fullPage: true });
  for (const entryRoute of ['r', 'n']) {
    await page.goto(`${base}/${entryRoute}/ui-invalid-token`);
    await page.locator('.customerError[role=alert]').waitFor();
    await page.getByRole('button', { name: 'Try loading again' }).click();
    await page.locator('.customerError[role=alert]').waitFor();
  }
  await page.goto(`${base}/n/mangal-counter-demo`);
  await page.getByRole('heading', { name: 'Mangal Traders', exact: true }).waitFor();
  await noOverflow(page);
  for (const route of ['login', 'signup']) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/${route}`);
    await page.locator('form').waitFor();
    await page.screenshot({ path: `${screenshots}/${route}.png`, fullPage: true });
    await page.setViewportSize({ width: 320, height: 700 });
    await noOverflow(page);
  }
  console.log('Customer NFC/QR entry routes, keyboard focus, sticky action, empty-draft controls and public auth layouts passed.');

  if (process.env.REVIEW_REPOSITORY === 'postgres') {
    const email = `ui-${randomUUID()}@example.com`;
    const password = `UiTest-${randomUUID()}`;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/signup`);
    await page.getByLabel('Your name', { exact: true }).fill('UI Test Owner');
    await page.getByLabel('Business name', { exact: true }).fill('Studio UI Test');
    await page.getByLabel('Work email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Start 7-day free trial' }).click();
    await page.getByRole('heading', { name: 'Tell us about your business' }).waitFor();
    await page.screenshot({ path: `${screenshots}/onboarding.png`, fullPage: true });
    await page.getByRole('button', { name: 'Continue to location' }).click();
    await page.getByLabel('Location label').fill('Studio Test Location');
    await page.getByLabel('Google Place ID', { exact: true }).fill('ChIJ-ui-test-place');
    await page.getByRole('button', { name: 'Save location' }).click();
    await page.getByRole('button', { name: 'Use these topics' }).click();
    await page.getByLabel('Card name / touchpoint', { exact: true }).fill('Studio Test Reception');
    await page.getByRole('button', { name: 'Create my first card' }).click();
    const customerPath = await page.locator('.onboardingQrMeta code').innerText();
    await page.getByRole('button', { name: 'Finish & open dashboard' }).click();
    await page.getByRole('heading', { name: 'Reputation overview' }).waitFor();
    const googleFunnel = page.locator('.merchantFunnelRow').filter({ hasText: 'Google opens' });
    assert.equal(await googleFunnel.locator('strong').innerText(), '0');
    assert.equal(await googleFunnel.locator('i').evaluate(el => el.getBoundingClientRect().width), 0, 'Zero events must have an empty funnel bar');
    assert.equal(await page.locator('.merchantTrendBar.google').evaluateAll(els => els.every(el => el.getBoundingClientRect().height === 0)), true, 'Zero activity days must not display nonzero bars');
    await page.goto(base + customerPath);
    await page.getByRole('heading', { name: 'Studio Test Location', exact: true }).waitFor();
    await page.setViewportSize({ width: 320, height: 700 });
    await noOverflow(page);
    assert.equal(await page.getByRole('link', { name: 'Business workspace' }).count(), 0);
    await page.getByRole('button', { name: '5 stars', exact: true }).click();
    await page.getByRole('textbox', { name: 'Generated review' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Copy & open Google review' }).isDisabled(), false);
    const pages = [['/dashboard', 'Overview'], ['/dashboard/locations', 'Locations'], ['/dashboard/topics', 'Topics'], ['/dashboard/qr-codes', 'NFC cards'], ['/dashboard/analytics', 'Analytics']];
    for (const [route, label] of pages) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(base + route);
      await page.locator('.merchantTopbar h1').waitFor();
      await noOverflow(page);
      assert.equal(await page.locator('.merchantNav a[aria-current="page"]').innerText(), label);
      if (route === '/dashboard/qr-codes') {
        await page.getByRole('button', { name: 'Copy NFC URL' }).first().click();
        const writtenUrl = await page.evaluate(() => navigator.clipboard.readText());
        assert.equal(new URL(writtenUrl).pathname, customerPath, 'NFC card copy action should target the new /n/ review route');
        assert.equal(await page.getByRole('button', { name: 'Copy QR URL' }).count() > 0, true, 'Legacy QR fallback must remain available');
      }
      if (route === '/dashboard') await page.screenshot({ path: `${screenshots}/dashboard.png`, fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow(page);
      assert.equal(await page.locator('.merchantMobileNav a').count(), 6);
      assert.equal(await page.locator('.merchantMobileNav a[aria-current="page"]').innerText(), label);
    }
    await page.goto(`${base}/billing`);
    await page.getByRole('heading', { name: 'Your subscription', exact: true }).waitFor();
    await noOverflow(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${screenshots}/billing.png`, fullPage: true });
    await page.goto(`${base}/dashboard`);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByLabel('Work email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Reputation overview' }).waitFor();
    console.log('Merchant signup, five onboarding steps, all workspace layouts, mobile navigation, billing, logout and login passed with PostgreSQL.');
  }
  assert.deepEqual(errors, [], 'No browser runtime errors are allowed');
} catch (error) {
  console.error(error);
  console.error(logs);
  process.exitCode = 1;
} finally {
  await browser?.close();
  app.kill('SIGTERM');
}
