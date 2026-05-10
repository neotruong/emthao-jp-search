// E2E smoke test for the frontend. Run with: node scripts/smoke-frontend.js
const { chromium } = require('playwright');

const BASE = process.env.FRONTEND_URL || 'http://localhost:5173';

async function step(label, fn) {
  process.stdout.write(`▶ ${label}\n`);
  await fn();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'vi-VN', // exercise the comma-decimal locale path on the WeightInput
  });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });

  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());

  await step('1. Navigate', async () => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('.brand h1', { timeout: 10000 });
  });

  await step('2. Search "iphone"', async () => {
    await page.fill('.search-input', 'iphone');
    await page.click('.search-submit');
    await page.waitForSelector('.card:not(.skeleton)', { timeout: 30000 });
    const n = await page.$$eval('.card:not(.skeleton)', (cs) => cs.length);
    console.log(`   visible cards: ${n}`);
  });

  await step('3. WeightInput accepts "0.3" (and the comma variant)', async () => {
    await page.fill('.weight-field', '0.3');
    await page.evaluate(() => document.querySelector('.weight-field').blur());
    await page.waitForTimeout(150);
    const v1 = await page.inputValue('.weight-field');
    const vnd1 = await page.textContent('.card:not(.skeleton) .price-vnd');
    await page.fill('.weight-field', '0,5');
    await page.evaluate(() => document.querySelector('.weight-field').blur());
    await page.waitForTimeout(150);
    const v2 = await page.inputValue('.weight-field');
    const vnd2 = await page.textContent('.card:not(.skeleton) .price-vnd');
    console.log(`   "0.3" → input="${v1}", first VND=${vnd1}`);
    console.log(`   "0,5" → input="${v2}", first VND=${vnd2}`);
  });

  await step('4. Sort by Newest update', async () => {
    await page.selectOption('.sort-select', 'newest');
    await page.waitForTimeout(150);
    const top3 = await page.$$eval('.card:not(.skeleton)', (cs) =>
      cs.slice(0, 3).map((c) => ({
        src: c.querySelector('.card-source')?.textContent?.trim(),
        title: c.querySelector('.card-title')?.textContent?.trim()?.slice(0, 40),
      }))
    );
    console.log(`   top 3 after sort: ${JSON.stringify(top3, null, 2)}`);
  });

  await step('5. Filter — VND mode, max 1,000,000 đ', async () => {
    await page.click('.currency-tab:has-text("VND")');
    const vndTab = await page.textContent('.currency-tab.active');
    await page.fill('.filter-price-pair input.filter-price:nth-of-type(1)', '');
    // there are two filter-price inputs; max is the second
    const inputs = await page.$$('.filter-price-pair input.filter-price');
    await inputs[1].fill('1000000');
    await page.waitForTimeout(150);
    const summary = await page.textContent('.filter-count');
    console.log(`   active currency tab: ${vndTab.trim()} | filter summary: ${summary}`);
  });

  await step('6. Switch back to JPY, set max ¥10,000', async () => {
    await page.click('.currency-tab:has-text("JPY")');
    const inputs = await page.$$('.filter-price-pair input.filter-price');
    await inputs[1].fill('10000');
    await page.waitForTimeout(150);
    const summary = await page.textContent('.filter-count');
    console.log(`   filter summary: ${summary}`);
  });

  await step('7. Reset filters and check baseline', async () => {
    await page.click('.filter-reset');
    await page.waitForTimeout(150);
    const summary = await page.textContent('.filter-count');
    console.log(`   summary after reset: ${summary}`);
  });

  await step('8. Pagination + history + bookmark + refresh smoke', async () => {
    const before = await page.$$eval('.card:not(.skeleton)', (cs) => cs.length);
    await page.click('.load-more');
    await page.waitForFunction((b) => document.querySelectorAll('.card:not(.skeleton)').length > b, before, { timeout: 30000 });
    const after = await page.$$eval('.card:not(.skeleton)', (cs) => cs.length);
    console.log(`   pagination: ${before} → ${after}`);

    await page.click('.card:not(.skeleton) .bookmark-btn');
    await page.click('.search-input');
    await page.waitForSelector('.history-dropdown', { timeout: 3000 });
    const hist = await page.$$eval('.history-pick .history-q', (els) => els.map((e) => e.textContent.trim()));
    console.log(`   history: ${JSON.stringify(hist)}`);

    await page.keyboard.press('Escape');
    await page.click('.search-refresh');
    await page.waitForSelector('.card:not(.skeleton)', { timeout: 30000 });
    console.log(`   refresh issued ✓`);
  });

  await page.screenshot({ path: '/tmp/emthao-features.png', fullPage: false });
  console.log('Screenshot: /tmp/emthao-features.png');

  if (errors.length) {
    console.log('\n=== JS errors ===');
    errors.forEach((e) => console.log(' ', e));
  } else {
    console.log('\nNo JS errors ✓');
  }

  await browser.close();
  process.exit(0);
})().catch((err) => {
  console.error('smoke test failed:', err);
  process.exit(1);
});
