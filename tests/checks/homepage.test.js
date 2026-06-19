const { test, expect } = require('@playwright/test');
const { runChecks } = require('../../crawler/checks/homepage');

test('detects working dropdown', async ({ page }) => {
  await page.setContent(`
    <html><body>
      <button class="dropdown-btn">Shop by Type</button>
      <ul class="dropdown-menu" style="display:none">
        <li><a href="/new">New</a></li>
      </ul>
      <script>
        document.querySelector('.dropdown-btn').addEventListener('click', () => {
          document.querySelector('.dropdown-menu').style.display = 'block';
        });
      </script>
    </body></html>
  `, { url: 'https://example.com/' });

  const findings = await runChecks(page, 'https://example.com/');
  const dropdownCheck = findings.find((f) => f.check === 'Shop by Vehicle dropdowns open');
  expect(dropdownCheck).toBeTruthy();
});

test('fails when chat widget is missing', async ({ page }) => {
  await page.setContent(`<html><body><p>No chat here</p></body></html>`, { url: 'https://example.com/' });
  const findings = await runChecks(page, 'https://example.com/');
  const chatCheck = findings.find((f) => f.check === 'Chat widget visible');
  expect(chatCheck.pass).toBe(false);
});
