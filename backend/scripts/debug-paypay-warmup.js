// Verify: does homepage→search consistently work? Run 3 different keywords with warmup,
// and (in same context) try one cold to confirm warmup matters.
const { newContext } = require('../src/browser');

const QUERIES = ['カメラ', 'iPhone', '香水'];

async function tryQuery(ctx, q, { warmup }) {
  const page = await ctx.newPage();
  try {
    if (warmup) {
      await page.goto('https://paypayfleamarket.yahoo.co.jp/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    }
    const resp = await page.goto(`https://paypayfleamarket.yahoo.co.jp/search/${encodeURIComponent(q)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    const status = resp.status();
    const itemCount = await page.$$eval('a[href*="/item/"]', (a) => a.length).catch(() => 0);
    const text = await page.evaluate(() => document.body.innerText || '').catch(() => '');
    const hasErrBanner = text.includes('データの取得に失敗しました');
    const hasRecoHeading = text.includes('あなたへのおすすめ');
    const title = await page.title();
    return { warmup, q, status, itemCount, hasErrBanner, hasRecoHeading, title: title.slice(0, 80) };
  } finally {
    await page.close().catch(() => {});
  }
}

(async () => {
  // Cold (no warmup) — fresh context, hit /search directly
  const ctxCold = await newContext();
  console.log('=== COLD: fresh context, hit /search directly ===');
  for (const q of QUERIES) {
    const r = await tryQuery(ctxCold, q, { warmup: false });
    console.log(' ', JSON.stringify(r));
  }
  await ctxCold.close();

  // Warmup — fresh context, visit homepage then search
  const ctxWarm = await newContext();
  console.log('\n=== WARMUP: fresh context, homepage → /search ===');
  for (const q of QUERIES) {
    const r = await tryQuery(ctxWarm, q, { warmup: true });
    console.log(' ', JSON.stringify(r));
  }
  await ctxWarm.close();

  process.exit(0);
})();
