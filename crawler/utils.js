const PAGE_TYPE_PATTERNS = {
  srp: ['/new-vehicles', '/new', '/inventory', '/vehicles', '/used-vehicles', '/used', '/certified'],
  specials: ['/specials', '/specials/new', '/offers', '/special-offers', '/current-offers'],
  service: ['/service', '/service-department', '/schedule-service', '/service-center'],
  finance: ['/finance', '/financing', '/apply', '/get-financed', '/credit-application'],
};

const PAGE_TYPE_NAV_KEYWORDS = {
  srp: ['inventory', 'vehicles', 'new vehicles', 'used vehicles', 'shop vehicles'],
  specials: ['specials', 'offers', 'deals', 'incentives'],
  service: ['service', 'maintenance', 'repair', 'schedule service'],
  finance: ['finance', 'financing', 'credit', 'apply', 'payment'],
};

function detectPageType(url) {
  let path;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return 'unknown';
  }

  if (path === '/' || path === '' || path === '/index.html') return 'homepage';

  if (/\/(specials|offers|deals|incentives)/.test(path)) return 'specials';
  if (/\/(service|parts|maintenance|schedule-service)/.test(path)) return 'service';
  if (/\/(finance|financing|credit|apply|prequalif)/.test(path)) return 'finance';

  if (/\/(new|used|certified|inventory|vehicles|srp)/.test(path)) {
    // VDP URLs typically have 4+ path segments or contain a VIN-like segment
    const segments = path.split('/').filter(Boolean);
    if (segments.length >= 4 || /[A-Z0-9]{17}/i.test(path) || /\d{4}[-_]/.test(path)) return 'vdp';
    return 'srp';
  }

  return 'unknown';
}

async function findPageUrl(page, siteUrl, pageType) {
  const base = new URL(siteUrl).origin;

  if (pageType === 'vdp') {
    // Discover VDP by navigating to SRP first
    const srpUrl = await findPageUrl(page, siteUrl, 'srp');
    if (!srpUrl) return null;
    try {
      await page.goto(srpUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const links = await page.$$('a[href*="/vehicles/"], a[href*="/vdp/"], a[href*="/inventory/"]');
      const link = (await Promise.all(links.map(async (l) => {
        const href = await l.getAttribute('href').catch(() => null);
        return href && href !== srpUrl ? l : null;
      }))).find((l) => l !== null) || null;
      if (link) {
        const href = await link.getAttribute('href');
        return href.startsWith('http') ? href : new URL(href, srpUrl).href;
      }
    } catch {
      return null;
    }
    return null;
  }

  const patterns = PAGE_TYPE_PATTERNS[pageType];
  if (!patterns) return null;

  // Try known URL patterns first
  for (const pattern of patterns) {
    const url = `${base}${pattern}`;
    try {
      const response = await page.request.get(url, { timeout: 8000 });
      if (response.ok()) return url;
    } catch {
      continue;
    }
  }

  // Fall back to nav link discovery
  try {
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const links = await page.$$eval('nav a[href], header a[href]', (els) =>
      els.map((el) => ({ href: el.href, text: el.textContent.trim().toLowerCase() }))
    );
    const keywords = PAGE_TYPE_NAV_KEYWORDS[pageType] || [];
    for (const link of links) {
      if (keywords.some((kw) => link.text.includes(kw) || link.href.includes(kw.replace(/ /g, '-')))) {
        return link.href;
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function findElementsByKeywords(page, keywords, selectors = ['button', 'a', '[role="button"]']) {
  const selector = selectors.join(', ');
  const elements = await page.$$(selector);
  const matches = [];

  for (const el of elements) {
    const text = (await el.textContent().catch(() => '')).toLowerCase();
    const ariaLabel = (await el.getAttribute('aria-label').catch(() => '') || '').toLowerCase();
    const combined = `${text} ${ariaLabel}`;
    if (keywords.some((kw) => combined.includes(kw.toLowerCase()))) {
      matches.push(el);
    }
  }

  return matches;
}

module.exports = { detectPageType, findPageUrl, findElementsByKeywords };
