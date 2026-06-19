const PAGE_TYPE_PATTERNS = {
  srp: ['/searchnew.aspx', '/searchused.aspx', '/new-inventory', '/new-vehicles', '/new', '/inventory', '/vehicles', '/used-vehicles', '/used', '/certified'],
  specials: ['/newspecials.html', '/used-specials', '/specialoffers', '/specials', '/specials/new', '/offers', '/special-offers', '/current-offers'],
  service: ['/service', '/service.aspx', '/service-department', '/schedule-service', '/service-center'],
  finance: ['/finance.aspx', '/finance-application.html', '/finance', '/financing', '/apply', '/get-financed', '/credit-application'],
};

const PAGE_TYPE_NAV_KEYWORDS = {
  srp: ['inventory', 'vehicles', 'new vehicles', 'used vehicles', 'shop vehicles', 'shop all new', 'shop new', 'shop all used', 'shop used'],
  specials: ['specials', 'offers', 'deals', 'incentives', 'new specials', 'used specials', 'special offers'],
  service: ['service', 'maintenance', 'repair', 'schedule service', 'service department'],
  finance: ['finance', 'financing', 'credit', 'apply', 'payment', 'finance department', 'finance application'],
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
      // Try specific VDP URL patterns first, then fall back to any listing link
      let links = await page.$$('a[href*="/vehicles/"], a[href*="/vdp/"], a[href*="/inventory/"]');
      if (links.length === 0) links = await page.$$('a[href]');
      const link = (await Promise.all(links.map(async (l) => {
        const href = await l.getAttribute('href').catch(() => null);
        if (!href || href === srpUrl) return null;
        try {
          const resolved = new URL(href, srpUrl).href;
          if (resolved.startsWith(base) && resolved !== srpUrl) return l;
        } catch { return null; }
        return null;
      }))).find(Boolean) || null;
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
