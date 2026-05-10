const { newContext } = require('../src/browser');

(async () => {
  const ctx = await newContext();
  const page = await ctx.newPage();

  const apiHits = [];
  page.on('response', async (resp) => {
    const u = resp.url();
    const ct = resp.headers()['content-type'] || '';
    if (u.includes('paypay') && ct.includes('json')) {
      try {
        const body = await resp.json();
        const sampleKeys = Array.isArray(body) ? `array[${body.length}]` : Object.keys(body || {}).slice(0, 6).join(',');
        apiHits.push({ url: u, status: resp.status(), keys: sampleKeys });
      } catch {}
    }
  });

  await page.goto('https://paypayfleamarket.yahoo.co.jp/search/iphone', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});

  console.log('=== All paypay JSON responses (any path) ===');
  apiHits.forEach((h) => console.log('  ', h.status, h.url.slice(0, 140), '|', h.keys));

  console.log('\n=== Walking up from a[href*="/item/"] to find card root ===');
  const cardStructure = await page.evaluate(() => {
    const a = document.querySelector('a[href*="/item/"]');
    if (!a) return null;
    // Walk up looking for a "card-like" parent (one with the title and price siblings)
    let node = a;
    const trail = [];
    for (let i = 0; i < 6 && node; i++) {
      trail.push({
        depth: i,
        tag: node.tagName,
        cls: node.className?.slice(0, 80),
        innerText: node.innerText?.replace(/\s+/g, ' ').slice(0, 150),
      });
      node = node.parentElement;
    }
    return trail;
  });
  console.log(JSON.stringify(cardStructure, null, 2));

  console.log('\n=== First 3 anchors innerText ===');
  const anchorTexts = await page.$$eval('a[href*="/item/"]', (as) =>
    as.slice(0, 3).map((a) => ({
      href: a.getAttribute('href'),
      innerText: a.innerText?.replace(/\s+/g, ' ').trim(),
      imgAlt: a.querySelector('img')?.getAttribute('alt') || null,
      imgSrc: a.querySelector('img')?.getAttribute('src')?.slice(0, 100) || null,
    }))
  );
  console.log(JSON.stringify(anchorTexts, null, 2));

  await ctx.close();
  process.exit(0);
})();
