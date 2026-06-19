const { test, expect } = require('@playwright/test');
const { runChecks } = require('../../crawler/checks/specials');

test('passes when specials listings are visible', async ({ page }) => {
  await page.setContent(`
    <html><body>
      <div class="special-offer"><h3>Save $2000</h3><a href="/vehicles/123">View Deal</a></div>
    </body></html>
  `, { url: 'https://example.com/specials' });
  const findings = await runChecks(page, 'https://example.com/');
  const listingCheck = findings.find((f) => f.check.includes('specials listings'));
  expect(listingCheck.pass).toBe(true);
});

test('fails when specials CTAs are missing', async ({ page }) => {
  await page.setContent(`
    <html><body>
      <div class="special-offer"><h3>Save $2000</h3><p>No links here</p></div>
    </body></html>
  `, { url: 'https://example.com/specials' });
  const findings = await runChecks(page, 'https://example.com/');
  const ctaCheck = findings.find((f) => f.check === 'Specials CTAs navigate to VDP or offer page');
  expect(ctaCheck.pass).toBe(false);
  expect(ctaCheck.reason).toContain('No specials CTA links found');
});
