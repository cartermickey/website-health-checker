const { test, expect } = require('@playwright/test');
const { runChecks } = require('../../crawler/checks/vdp');

test('detects modal opening for trade CTA', async ({ page }) => {
  await page.setContent(`
    <html><body>
      <button id="trade-btn">Value Your Trade</button>
      <div class="modal trade-modal" style="display:none"><form><input type="text" placeholder="Enter mileage"></form></div>
      <span class="price">$29,995</span>
      <span class="vin">1HGCM82633A123456</span>
      <span class="stock">STK-12345</span>
      <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="car">
      <script>
        document.getElementById('trade-btn').addEventListener('click', () => {
          document.querySelector('.modal.trade-modal').style.display = 'block';
        });
      </script>
    </body></html>
  `, { url: 'https://example.com/vehicles/2024-honda-civic' });

  const findings = await runChecks(page, 'https://example.com/');
  const tradeCheck = findings.find((f) => f.check === '"Value Your Trade" modal opens');
  expect(tradeCheck.pass).toBe(true);
});

test('fails when trade CTA is missing', async ({ page }) => {
  await page.setContent(`<html><body><p>No CTAs here</p></body></html>`, { url: 'https://example.com/vehicles/123' });
  const findings = await runChecks(page, 'https://example.com/');
  const tradeCheck = findings.find((f) => f.check === '"Value Your Trade" modal opens');
  expect(tradeCheck.pass).toBe(false);
});
