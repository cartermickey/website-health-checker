const { findElementsByKeywords } = require('../utils');

async function runChecks(page, siteUrl) {
  const findings = [];

  // Check for embedded scheduler widget/iframe
  const scheduler = await page.$(
    'iframe[src*="schedule"], iframe[src*="appointment"], iframe[src*="service"], ' +
    '[class*="scheduler"], [class*="appointment"], [id*="scheduler"], [id*="appointment"], ' +
    'form[action*="appointment"], form[action*="schedule"]'
  ).catch(() => null);
  const schedulerVisible = scheduler ? await scheduler.isVisible().catch(() => false) : false;

  // Also accept a visible "Schedule Service" link/button (many dealers link out to a scheduling page)
  let scheduleLink = null;
  if (!schedulerVisible) {
    const links = await findElementsByKeywords(
      page,
      ['schedule service', 'schedule an appointment', 'book service', 'service appointment', 'request an appointment', 'schedule maintenance'],
      ['a[href]', 'button']
    );
    for (const link of links) {
      const href = await link.getAttribute('href').catch(() => null);
      const visible = await link.isVisible().catch(() => false);
      if (href && href !== '#' && !href.startsWith('javascript:') && visible) {
        scheduleLink = link;
        break;
      }
    }
  }

  let serviceDetails = null;
  if (!schedulerVisible && !scheduleLink) {
    const pageLinks = await page.$$eval('a[href]', (els) => els.slice(0, 8).map((e) => e.textContent.trim()).filter(Boolean)).catch(() => []);
    serviceDetails = [`No schedule link found. Page links include: ${pageLinks.length > 0 ? pageLinks.join(', ') : 'none'}`];
  }
  findings.push({
    check: 'Appointment scheduler loads',
    pass: schedulerVisible || !!scheduleLink,
    reason: !schedulerVisible && !scheduleLink ? 'Scheduler widget or schedule service link not found/visible' : null,
    details: serviceDetails,
  });

  // Interactivity check only applies if an embedded widget was found
  if (schedulerVisible) {
    let interactive = false;
    try {
      const input = await page.$('input[type="text"], input[type="date"], select, [class*="date-picker"]');
      if (input) interactive = await input.isEnabled();
    } catch { /* ignore */ }
    findings.push({
      check: 'Scheduler is interactive',
      pass: interactive,
      reason: !interactive ? 'Scheduler found but no interactive inputs detected' : null,
    });
  }

  return findings;
}

module.exports = { runChecks };
