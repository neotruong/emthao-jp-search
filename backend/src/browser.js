const { chromium } = require('playwright');
const { logger } = require('./logger');
const { pickUA } = require('./config/userAgents');

let browserPromise = null;

async function launch() {
  logger.info('Launching Chromium…');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  browser.on('disconnected', () => {
    logger.warn('Browser disconnected — clearing singleton');
    browserPromise = null;
  });
  return browser;
}

function getBrowser() {
  if (!browserPromise) {
    browserPromise = launch().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

async function newContext() {
  const browser = await getBrowser();
  const context = await browser.newContext({
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    userAgent: pickUA(),
    viewport: { width: 1366, height: 850 },
    extraHTTPHeaders: {
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    },
  });
  // Force JP locale on geo-aware sites (Mercari sets country_code from geo-IP and localizes prices).
  await context.addCookies([
    { name: 'country_code', value: 'JP', domain: '.mercari.com', path: '/' },
    { name: 'country_code', value: 'JP', domain: 'jp.mercari.com', path: '/' },
  ]);
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  return context;
}

async function isConnected() {
  if (!browserPromise) return false;
  try {
    const b = await browserPromise;
    return b.isConnected();
  } catch {
    return false;
  }
}

module.exports = { getBrowser, newContext, isConnected };
