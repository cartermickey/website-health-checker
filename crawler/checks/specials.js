const { findElementsByKeywords } = require('../utils');

async function runChecks(page, siteUrl) {
  const findings = [];
  const pageUrl = page.url();
  const isNew = /new/i.test(pageUrl);
  const isUsed = /used|pre.?owned/i.test(pageUrl);
  const label = isNew ? 'New' : isUsed ? 'Pre-Owned' : 'Specials';

  const listingEls = await page.$$(
    '[class*="special"], [class*="offer"], [class*="deal"], [class*="incentive"], ' +
    '[class*="promo"], [class*="vehicle-card"]'
  ).catch(() => []);
  findings.push({
    check: `${label} specials listings display`,
    pass: listingEls.length > 0,
    reason: listingEls.length === 0 ? 'No specials/offers listings found on page' : null,
  });

  // CTAs link to VDP or offer page
  const ctaLinks = await findElementsByKeywords(
    page,
    ['view', 'details', 'get deal', 'claim', 'see offer', 'shop now'],
    ['a[href]']
  );
  let ctaValid = ctaLinks.length === 0;
  for (const link of ctaLinks.slice(0, 3)) {
    const href = await link.getAttribute('href').catch(() => null);
    if (href && href !== '#' && !href.startsWith('javascript:')) { ctaValid = true; break; }
  }
  findings.push({
    check: 'Specials CTAs navigate to VDP or offer page',
    pass: ctaValid,
    reason: !ctaValid && ctaLinks.length > 0 ? 'Specials CTA links have no valid targets' : null,
  });

  return findings;
}

module.exports = { runChecks };
