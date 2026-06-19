const { test, expect } = require('@playwright/test');
const { runChecks } = require('../../crawler/checks/srp');

test('passes when pricing is visible on listings', async ({ page }) => {
  await page.setContent(`
    <html><body>
      <div class="vehicle-card">
        <span class="price">$25,995</span>
        <a href="/vehicles/123" class="btn">View Details</a>
      </div>
    </body></html>
  `, { url: 'https://example.com/inventory' });

  const findings = await runChecks(page, 'https://example.com/');
  const priceCheck = findings.find((f) => f.check === 'Listings display pricing');
  expect(priceCheck.pass).toBe(true);
});

test('fails when no pricing is visible', async ({ page }) => {
  await page.setContent(`
    <html><body><div class="vehicle-card"><p>No price here</p></div></body></html>
  `, { url: 'https://example.com/inventory' });

  const findings = await runChecks(page, 'https://example.com/');
  const priceCheck = findings.find((f) => f.check === 'Listings display pricing');
  expect(priceCheck.pass).toBe(false);
});
