async function runChecks(page, siteUrl) {
  const findings = [];

  const scheduler = await page.$(
    'iframe[src*="schedule"], iframe[src*="appointment"], iframe[src*="service"], ' +
    '[class*="scheduler"], [class*="appointment"], [id*="scheduler"], [id*="appointment"], ' +
    'form[action*="appointment"], form[action*="schedule"]'
  ).catch(() => null);
  const schedulerVisible = scheduler ? await scheduler.isVisible().catch(() => false) : false;

  findings.push({
    check: 'Appointment scheduler loads',
    pass: schedulerVisible,
    reason: !schedulerVisible ? 'Scheduler widget or iframe not found/visible' : null,
  });

  if (schedulerVisible) {
    let interactive = false;
    try {
      const input = await page.$('input[type="text"], input[type="date"], select, [class*="date-picker"]');
      if (input) { interactive = await input.isEnabled(); }
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
