// Probe alternative PayPay search URL patterns + see what URL the homepage's search form submits to.
const { newContext } = require('../src/browser');

const QUERY = 'カメラ';

(async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();

  console.log('=== 1. Homepage form: where does the search box submit to? ===');
  try {
    await page.goto('https://paypayfleamarket.yahoo.co.jp/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    const formInfo = await page.evaluate(() => {
      const form = document.querySelector('form');
      const input = document.querySelector('input[type="search"], input[name*="keyword"], input[name*="query"]');
      return {
        formAction: form?.getAttribute('action') || null,
        formMethod: form?.getAttribute('method') || null,
        inputName: input?.getAttribute('name') || null,
        inputPlaceholder: input?.getAttribute('placeholder') || null,
      };
    });
    console.log(JSON.stringify(formInfo, null, 2));

    // Try submitting the search via the form mechanism — capture where it ends up.
    const captureUrl = new Promise((resolve) => {
      page.once('framenavigated', (f) => resolve(f.url()));
      setTimeout(() => resolve('<no nav>'), 5000);
    });
    await page.evaluate((q) => {
      const input = document.querySelector('input[type="search"], input[name*="keyword"], input[name*="query"]');
      if (!input) return;
      input.value = q;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const form = input.closest('form');
      form?.submit();
    }, QUERY);
    const navTo = await captureUrl;
    console.log(`form.submit() → ${navTo}`);
  } catch (e) {
    console.log('homepage err:', e.message);
  }

  console.log('\n=== 2. Try alternative search URL patterns (status code only) ===');
  const urls = [
    `https://paypayfleamarket.yahoo.co.jp/search/${encodeURIComponent(QUERY)}`,
    `https://paypayfleamarket.yahoo.co.jp/search?keyword=${encodeURIComponent(QUERY)}`,
    `https://paypayfleamarket.yahoo.co.jp/search?query=${encodeURIComponent(QUERY)}`,
    `https://paypayfleamarket.yahoo.co.jp/search/result/${encodeURIComponent(QUERY)}`,
    `https://paypayfleamarket.yahoo.co.jp/search/result?keyword=${encodeURIComponent(QUERY)}`,
    `https://paypayfleamarket.yahoo.co.jp/category/0/${encodeURIComponent(QUERY)}`,
    `https://paypayfleamarket.yahoo.co.jp/categories/search?keyword=${encodeURIComponent(QUERY)}`,
  ];
  for (const u of urls) {
    const p = await ctx.newPage();
    try {
      const resp = await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const itemCount = await p.$$eval('a[href*="/item/"]', (a) => a.length);
      const title = await p.title();
      const errorBanner = await p.evaluate(() => document.body.innerText.includes('データの取得に失敗しました'));
      const hasReco = await p.evaluate(() => document.body.innerText.includes('あなたへのおすすめ'));
      console.log(`  [${resp.status()}] items:${itemCount} err:${errorBanner} reco:${hasReco}  ${u.slice(0, 110)}`);
      console.log(`         title: ${title.slice(0, 80)}`);
    } catch (e) {
      console.log(`  [ERR] ${u.slice(0, 110)} — ${e.message}`);
    }
    await p.close();
  }

  await ctx.close();
  process.exit(0);
})();
