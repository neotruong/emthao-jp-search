const lastHitByDomain = new Map();
const PER_DOMAIN_DELAY_MS = 1000;

async function paceDomain(domain) {
  const last = lastHitByDomain.get(domain) || 0;
  const wait = Math.max(0, PER_DOMAIN_DELAY_MS - (Date.now() - last));
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastHitByDomain.set(domain, Date.now());
}

module.exports = { paceDomain };
