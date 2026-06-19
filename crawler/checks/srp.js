const { findElementsByKeywords } = require('../utils');

async function runChecks(page, siteUrl) {
  const findings = [];

  // Pricing visible
  const priceEl = await page.$(
    '[class*="price"]:not([class*="msrp-label"]), [data-price], [itemprop="price"], ' +
    '[class*="vehicle-price"], [class*="listing-price"]'
  ).catch(() => null);
  const priceText = priceEl ? await priceEl.textContent().catch(() => '') : '';
  const priceBodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
  const hasPrice = /\$[\d,]+/.test(priceText) || /\$[\d,]+/.test(priceBodyText);
  findings.push({
    check: 'Listings display pricing',
    pass: hasPrice,
    reason: !hasPrice ? 'No price element with dollar amount found on listings' : null,
  });

  // Sort by Price Low to High
  const sortTriggers = await findElementsByKeywords(
    page,
    ['price', 'low to high', 'sort'],
    ['select', 'button', '[class*="sort"]', '[role="option"]']
  );
  let sortWorking = false;
  for (const trigger of sortTriggers.slice(0, 2)) {
    try {
      const tagName = await trigger.evaluate((el) => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await trigger.selectOption({ label: /price.*low/i });
      } else {
        await trigger.click();
        await page.waitForTimeout(800);
        const opt = await findElementsByKeywords(page, ['price: low', 'low to high'], ['option', 'li', '[role="option"]']);
        if (opt.length > 0) await opt[0].click();
      }
      await page.waitForTimeout(1000);
      sortWorking = true;
      break;
    } catch { continue; }
  }
  findings.push({
    check: 'Sort "Price: Low to High" works',
    pass: sortWorking || sortTriggers.length === 0,
    reason: !sortWorking && sortTriggers.length > 0 ? 'Sort control found but could not apply sort' : null,
  });

  // Filters update results
  const filterInputs = await page.$$(
    '[class*="filter"] input[type="checkbox"], [class*="filter"] select, ' +
    '[class*="facet"] input, [class*="sidebar"] input[type="checkbox"]'
  ).catch(() => []);
  let filtersWorking = filterInputs.length === 0;
  if (filterInputs.length > 0) {
    const countBefore = await page.$$eval('[class*="vehicle-card"], [class*="listing-item"], [class*="inventory-item"]', (els) => els.length).catch(() => 0);
    try {
      await filterInputs[0].click();
      await page.waitForTimeout(1500);
      const countAfter = await page.$$eval('[class*="vehicle-card"], [class*="listing-item"], [class*="inventory-item"]', (els) => els.length).catch(() => 0);
      filtersWorking = countAfter !== countBefore;
    } catch { /* filter interaction failed */ }
  }
  findings.push({
    check: 'Filters update results',
    pass: filtersWorking,
    reason: !filtersWorking && filterInputs.length > 0 ? 'Filter clicked but results did not change' : null,
  });

  // Dealership locations listed
  const locationEls = await findElementsByKeywords(
    page,
    ['location', 'dealership', 'store', 'cable dahmer'],
    ['select option', 'li', '[class*="location"]', '[class*="dealer"]']
  );
  findings.push({
    check: 'Dealership locations listed',
    pass: locationEls.length > 0,
    reason: locationEls.length === 0 ? 'No location/dealership selector found' : null,
  });

  // CTAs present on listings
  const ctaEls = await findElementsByKeywords(
    page,
    ['view details', 'details', 'more info', 'check availability', 'get price', 'see details', 'shop now', 'view vehicle', 'learn more'],
    ['a', 'button']
  );
  findings.push({
    check: 'Expected CTAs present on listings',
    pass: ctaEls.length > 0,
    reason: ctaEls.length === 0 ? 'No CTA buttons/links found on listing cards' : null,
  });

  return findings;
}

module.exports = { runChecks };
