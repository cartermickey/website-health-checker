const { test, expect } = require('@playwright/test');
const { runChecks } = require('../../crawler/checks/finance');

test('passes when finance form fields are visible', async ({ page }) => {
  await page.setContent(`
    <html><body>
      <form id="prequalify"><input type="text" placeholder="First Name"><input type="text" placeholder="Last Name"></form>
    </body></html>
  `, { url: 'https://example.com/finance' });
  const findings = await runChecks(page, 'https://example.com/');
  const formCheck = findings.find((f) => f.check.includes('Prequalification'));
  expect(formCheck.pass).toBe(true);
});
