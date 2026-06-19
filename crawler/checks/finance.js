const { findElementsByKeywords } = require('../utils');

async function runChecks(page, siteUrl) {
  const findings = [];

  // Check for embedded prequalification form
  const prequalForm = await page.$(
    'form[id*="prequal"], form[class*="prequal"], ' +
    'iframe[src*="prequal"], iframe[src*="credit"], ' +
    '[class*="prequal"], [id*="prequal"]'
  ).catch(() => null);
  const prequalVisible = prequalForm
    ? await prequalForm.isVisible().catch(() => false)
    : await page.$('input[placeholder*="name" i], input[name*="first"]').then((el) => el ? el.isVisible() : false).catch(() => false);

  // Also accept a visible prequalification link (some dealers link out to a separate prequal page)
  let prequalLink = null;
  if (!prequalVisible) {
    const links = await findElementsByKeywords(
      page,
      ['prequalif', 'pre-qualif', 'get pre-qualified', 'buying power', 'financing help', 'bad credit', 'credit approval'],
      ['a[href]', 'button']
    );
    for (const link of links) {
      const href = await link.getAttribute('href').catch(() => null);
      const visible = await link.isVisible().catch(() => false);
      if (href && href !== '#' && !href.startsWith('javascript:') && visible) {
        prequalLink = link;
        break;
      }
    }
  }

  findings.push({
    check: 'Prequalification form displays',
    pass: prequalVisible || !!prequalLink,
    reason: !prequalVisible && !prequalLink ? 'Prequalification form or link not found/visible' : null,
  });

  // Check for embedded finance application form
  const financeForm = await page.$(
    'form[id*="finance"], form[class*="finance"], ' +
    'iframe[src*="finance"], iframe[src*="RouteOne"], iframe[src*="dealertrack"], ' +
    '[class*="finance-app"], [id*="credit-app"]'
  ).catch(() => null);
  const financeVisible = financeForm ? await financeForm.isVisible().catch(() => false) : false;

  // Also accept a visible finance application link
  let financeLink = null;
  if (!financeVisible) {
    const links = await findElementsByKeywords(
      page,
      ['finance application', 'apply now', 'apply for financing', 'credit application', 'finance app', 'apply online'],
      ['a[href]', 'button']
    );
    for (const link of links) {
      const href = await link.getAttribute('href').catch(() => null);
      const visible = await link.isVisible().catch(() => false);
      if (href && href !== '#' && !href.startsWith('javascript:') && visible) {
        financeLink = link;
        break;
      }
    }
  }

  findings.push({
    check: 'Finance Application form displays',
    pass: financeVisible || !!financeLink,
    reason: !financeVisible && !financeLink ? 'Finance application form or link not found/visible' : null,
  });

  return findings;
}

module.exports = { runChecks };
