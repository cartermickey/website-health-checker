async function runChecks(page, siteUrl) {
  const findings = [];

  const prequalForm = await page.$(
    'form[id*="prequal"], form[class*="prequal"], ' +
    'iframe[src*="prequal"], iframe[src*="credit"], ' +
    '[class*="prequal"], [id*="prequal"]'
  ).catch(() => null);
  const prequalVisible = prequalForm
    ? await prequalForm.isVisible().catch(() => false)
    : await page.$('input[placeholder*="name" i], input[name*="first"]').then((el) => el ? el.isVisible() : false).catch(() => false);

  findings.push({
    check: 'Prequalification form displays',
    pass: prequalVisible,
    reason: !prequalVisible ? 'Prequalification form or fields not found/visible' : null,
  });

  const financeForm = await page.$(
    'form[id*="finance"], form[class*="finance"], ' +
    'iframe[src*="finance"], iframe[src*="RouteOne"], iframe[src*="dealertrack"], ' +
    '[class*="finance-app"], [id*="credit-app"]'
  ).catch(() => null);
  const financeVisible = financeForm ? await financeForm.isVisible().catch(() => false) : false;

  findings.push({
    check: 'Finance Application form displays',
    pass: financeVisible,
    reason: !financeVisible ? 'Finance application form or iframe not found/visible' : null,
  });

  return findings;
}

module.exports = { runChecks };
