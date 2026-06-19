const { findElementsByKeywords } = require('../utils');

async function tryModalCTA(page, keywords, checkName) {
  const triggers = await findElementsByKeywords(page, keywords, ['button', 'a', '[role="button"]']);
  if (triggers.length === 0) {
    return { check: checkName, pass: false, reason: 'Button not found on page' };
  }
  for (const trigger of triggers) {
    try {
      const urlBefore = page.url();
      await trigger.click();
      await page.waitForTimeout(1500);
      // Accept URL navigation as a pass (e.g. /trade.aspx, /paymentcalc.aspx)
      if (page.url() !== urlBefore) {
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
        return { check: checkName, pass: true, reason: null };
      }
      // Also accept modal/overlay appearing
      const modal = await page.$(
        '[class*="modal"]:visible, [class*="dialog"]:visible, [class*="overlay"]:visible, ' +
        '[role="dialog"]:visible, [class*="drawer"]:visible'
      ).catch(() => null);
      if (modal) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        return { check: checkName, pass: true, reason: null };
      }
    } catch { continue; }
  }
  return { check: checkName, pass: false, reason: 'Button clicked but no modal or navigation occurred' };
}

async function runChecks(page, siteUrl) {
  const findings = [];

  findings.push(await tryModalCTA(page, ['value your trade', 'trade', 'trade-in', 'trade in', 'get trade'], '"Value Your Trade" modal opens'));
  findings.push(await tryModalCTA(page, ['calculate', 'payment', 'monthly payment', 'estimate payment'], '"Calculate Your Payment" modal opens'));
  findings.push(await tryModalCTA(page, ['prequalif', 'pre-qualif', 'get qualified', 'credit', 'financing'], '"Get Prequalified" modal opens'));
  findings.push(await tryModalCTA(page, ['test drive', 'schedule', 'schedule a test drive', 'book a test drive'], '"Schedule a Test Drive" modal opens'));

  // Vehicle price
  const priceEl = await page.$('[class*="price"], [data-price], [itemprop="price"]').catch(() => null);
  const priceText = priceEl ? await priceEl.textContent().catch(() => '') : '';
  const priceBodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
  const hasPrice = /\$[\d,]+/.test(priceText) || /\$[\d,]+/.test(priceBodyText);
  findings.push({
    check: 'Vehicle price is present',
    pass: hasPrice,
    reason: !hasPrice ? 'No price element with dollar amount found' : null,
  });

  // VIN
  const vinEl = await page.$('[class*="vin"], [data-vin], [itemprop="vehicleIdentificationNumber"]').catch(() => null);
  const vinText = vinEl ? await vinEl.textContent().catch(() => '') : '';
  const bodyText = await page.textContent('body').catch(() => '');
  const vinMatch = vinText.match(/[A-HJ-NPR-Z0-9]{17}/) || bodyText.match(/VIN[:\s]+([A-HJ-NPR-Z0-9]{17})/);
  findings.push({
    check: 'VIN is present',
    pass: !!vinMatch,
    reason: !vinMatch ? 'No VIN found on page' : null,
  });

  // Stock number
  const stockEl = await page.$('[class*="stock"], [data-stock]').catch(() => null);
  const stockText = stockEl ? await stockEl.textContent().catch(() => '') : '';
  const hasStock = stockText.trim().length > 0 || /stock\s*[:#]\s*[A-Z0-9]{3,}/i.test(bodyText);
  findings.push({
    check: 'Stock number is present',
    pass: hasStock,
    reason: !hasStock ? 'No stock number found on page' : null,
  });

  // Images
  const imgSrcs = await page.$$eval('img[src]', (imgs) =>
    imgs.map((i) => i.src).filter((s) => !s.startsWith('data:'))
  ).catch(() => []);
  const brokenImages = [];
  for (const src of imgSrcs.slice(0, 20)) {
    try {
      const res = await page.request.get(src, { timeout: 5000 });
      if (res.status() >= 400) brokenImages.push(src);
    } catch { brokenImages.push(src); }
  }
  findings.push({
    check: 'All vehicle images load',
    pass: imgSrcs.length > 0 && brokenImages.length === 0,
    reason: imgSrcs.length === 0
      ? 'No vehicle images found on page'
      : brokenImages.length > 0
        ? `${brokenImages.length} broken image(s)`
        : null,
  });

  return findings;
}

module.exports = { runChecks };
