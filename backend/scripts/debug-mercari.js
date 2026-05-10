const { newContext } = require('../src/browser');

(async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();

  let apiBody = null;
  page.on('response', async (resp) => {
    if (resp.url().includes('/v2/entities:search')) {
      try { apiBody = await resp.json(); } catch {}
    }
  });

  await page.goto('https://jp.mercari.com/search?keyword=fan', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="item-cell"]', { timeout: 12000 });
  await page.waitForTimeout(1500);

  if (!apiBody) {
    console.log('Did not capture API response');
    await ctx.close();
    process.exit(1);
  }

  const items = apiBody.items || [];
  console.log('items count:', items.length);
  if (items[0]) {
    console.log('first item keys:', Object.keys(items[0]));
    console.log('first item:', JSON.stringify(items[0], null, 2).slice(0, 1500));
  }

  await ctx.close();
  process.exit(0);
})();
