const { test, expect } = require('@playwright/test');
const { runChecks } = require('../../crawler/checks/service');

test('fails when scheduler is missing', async ({ page }) => {
  await page.setContent(`<html><body><p>No scheduler here</p></body></html>`, { url: 'https://example.com/service' });
  const findings = await runChecks(page, 'https://example.com/');
  const schedulerCheck = findings.find((f) => f.check === 'Appointment scheduler loads');
  expect(schedulerCheck.pass).toBe(false);
});
