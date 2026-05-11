// Wider PayPay probe: capture ALL XHR/fetch responses (not just paypay.yahoo.co.jp domain),
// log status + URL + content-type + first 200 bytes, and try a few candidate search endpoints
// with raw fetch from inside the page context (so cookies + Yahoo auth headers propagate).
const { newContext } = require('../src/browser');

const QUERY = 'カメラ';

(async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();

  const xhrs = [];
  page.on('response', async (resp) => {
    const req = resp.request();
    const type = req.resourceType();
    if (type !== 'xhr' && type !== 'fetch' && type !== 'document') return;
    const u = resp.url();
    const ct = resp.headers()['content-type'] || '';
    let snippet = '';
    if (ct.includes('json') || ct.includes('text')) {
      try {
        snippet = (await resp.text()).slice(0, 200).replace(/\s+/g, ' ');
      } catch {}
    }
    xhrs.push({ status: resp.status(), method: req.method(), type, url: u.slice(0, 160), ct: ct.slice(0, 40), snippet });
  });

  console.log(`=== Loading /search/${QUERY} ===`);
  try {
    await page.goto(`https://paypayfleamarket.yahoo.co.jp/search/${encodeURIComponent(QUERY)}`, {
      waitUntil: 'networkidle',
      timeout: 20000,
    });
  } catch (e) {
    console.log('navigate err:', e.message);
  }

  console.log(`\n=== ALL XHR/fetch responses (${xhrs.length}) ===`);
  for (const r of xhrs) {
    console.log(`  ${r.status} ${r.method} [${r.type}] ${r.url}`);
    if (r.snippet) console.log(`     ${r.snippet}`);
  }

  // Probe candidate search endpoints from inside the page so cookies + same-origin headers carry.
  const candidates = [
    `/api/v1/search/items?keyword=${encodeURIComponent(QUERY)}&resultNum=20`,
    `/api/v1/search?keyword=${encodeURIComponent(QUERY)}&resultNum=20`,
    `/api/v2/search/items?keyword=${encodeURIComponent(QUERY)}&resultNum=20`,
    `/api/v1/items/search?keyword=${encodeURIComponent(QUERY)}&resultNum=20`,
    `/api/v1/recommend/items?recommendType=fleamarket_web_search&resultNum=20&keyword=${encodeURIComponent(QUERY)}`,
    `/api/v1/recommend/items?recommendType=fleamarket_web_search&resultNum=20&query=${encodeURIComponent(QUERY)}`,
  ];

  console.log(`\n=== Probing candidate endpoints from page context ===`);
  for (const path of candidates) {
    const result = await page.evaluate(async (p) => {
      try {
        const r = await fetch(p, { credentials: 'include' });
        const ct = r.headers.get('content-type') || '';
        const txt = await r.text();
        let parsed = null;
        if (ct.includes('json')) {
          try { parsed = JSON.parse(txt); } catch {}
        }
        const meta = parsed && {
          totalResultsReturned: parsed.totalResultsReturned,
          itemsLen: Array.isArray(parsed.items) ? parsed.items.length : null,
          firstItemTitle: parsed.items?.[0]?.title || null,
          firstItemId: parsed.items?.[0]?.itemId || null,
        };
        return { status: r.status, ct, len: txt.length, snippet: txt.slice(0, 240).replace(/\s+/g, ' '), meta };
      } catch (e) {
        return { error: e.message };
      }
    }, path);
    console.log(`  ${path}`);
    console.log(`    →`, JSON.stringify(result));
  }

  // Sanity: confirm item detail page works (user reported this).
  console.log(`\n=== Item detail check (/item/z572523422) ===`);
  try {
    const itemPage = await ctx.newPage();
    const resp = await itemPage.goto('https://paypayfleamarket.yahoo.co.jp/item/z572523422', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    const title = await itemPage.title();
    const ogTitle = await itemPage.$eval('meta[property="og:title"]', (el) => el.content).catch(() => null);
    const priceText = await itemPage
      .$eval('[class*="price"], [data-testid*="price"]', (el) => el.innerText)
      .catch(() => null);
    console.log(`  status: ${resp.status()}`);
    console.log(`  <title>: ${title}`);
    console.log(`  og:title: ${ogTitle}`);
    console.log(`  price element text: ${priceText}`);
    await itemPage.close();
  } catch (e) {
    console.log('  item-page err:', e.message);
  }

  await ctx.close();
  process.exit(0);
})();
