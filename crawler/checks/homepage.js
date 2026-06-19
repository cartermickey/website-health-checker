const { findElementsByKeywords } = require('../utils');

async function runChecks(page, siteUrl) {
  const findings = [];

  // Shop by Vehicle dropdowns
  const dropdownTriggers = await findElementsByKeywords(
    page,
    ['shop by', 'shop vehicles', 'vehicle type', 'make', 'model', 'type'],
    ['button', 'select', '[role="combobox"]', '[class*="dropdown"]']
  );
  let dropdownWorking = false;
  for (const trigger of dropdownTriggers) {
    try {
      await trigger.click();
      await page.waitForTimeout(500);
      const openMenu = await page.$('[class*="dropdown-menu"]:visible, [class*="dropdown-content"]:visible, select option');
      if (openMenu) { dropdownWorking = true; break; }
    } catch { continue; }
  }
  findings.push({
    check: 'Shop by Vehicle dropdowns open',
    pass: dropdownWorking || dropdownTriggers.length === 0, // pass if no dropdowns found (site may not have them)
    reason: !dropdownWorking && dropdownTriggers.length > 0 ? 'Dropdown did not open on click' : null,
  });

  // CTAs navigate correctly
  const ctaLinks = await findElementsByKeywords(
    page,
    ['shop', 'view', 'inventory', 'explore', 'browse', 'get started'],
    ['a[href]']
  );
  let ctaWorking = ctaLinks.length === 0;
  for (const cta of ctaLinks.slice(0, 3)) {
    const href = await cta.getAttribute('href').catch(() => null);
    if (href && href !== '/' && !href.startsWith('#')) { ctaWorking = true; break; }
  }
  findings.push({
    check: 'CTAs have valid navigation targets',
    pass: ctaWorking,
    reason: !ctaWorking ? 'CTA links found but none have valid href targets' : null,
  });

  // Rotators
  const rotators = await page.$$('[class*="rotator"] a, [class*="slider"] a, [class*="banner"] a, [class*="carousel"] a').catch(() => []);
  let rotatorWorking = rotators.length === 0;
  for (const r of rotators.slice(0, 2)) {
    const href = await r.getAttribute('href').catch(() => null);
    if (href && href !== '#' && !href.startsWith('javascript:')) { rotatorWorking = true; break; }
  }
  findings.push({
    check: 'Rotators have valid navigation targets',
    pass: rotatorWorking,
    reason: !rotatorWorking && rotators.length > 0 ? 'Rotator links found but none navigate' : null,
  });

  // Chat widget
  const chatWidget = await page.$(
    '[id*="chat"], [class*="chat"], [class*="livechat"], [id*="livechat"], ' +
    '[class*="drift"], [class*="intercom"], iframe[src*="chat"], iframe[src*="live"]'
  ).catch(() => null);
  const chatVisible = chatWidget ? await chatWidget.isVisible().catch(() => false) : false;
  findings.push({
    check: 'Chat widget visible',
    pass: chatVisible,
    reason: !chatVisible ? 'Chat widget not found or not visible' : null,
  });

  return findings;
}

module.exports = { runChecks };
