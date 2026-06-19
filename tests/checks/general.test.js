const { test, expect } = require('@playwright/test');
const { runChecks } = require('../../crawler/checks/general');

const MOCK_HTML = `
  <html><head></head><body>
    <nav>
      <a href="https://example.com/">Home</a>
      <a href="https://example.com/about">About</a>
    </nav>
    <img src="https://example.com/img/car.jpg" alt="car">
  </body></html>
`;

test('passes when page loads fast and nav links respond 200', async ({ page }) => {
  await page.route('https://example.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: MOCK_HTML })
  );

  const findings = await runChecks(page, 'https://example.com/');
  const loadCheck = findings.find((f) => f.check === 'Page loads under 3 seconds');
  expect(loadCheck.pass).toBe(true);
  const navCheck = findings.find((f) => f.check === 'No broken navigation links');
  expect(navCheck.pass).toBe(true);
});

test('fails when a nav link returns 404', async ({ page }) => {
  await page.route('https://example.com/', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: `
      <html><body><nav><a href="https://example.com/broken">Broken</a></nav></body></html>
    ` })
  );
  await page.route('https://example.com/broken', (route) => route.fulfill({ status: 404 }));

  const findings = await runChecks(page, 'https://example.com/');
  const navCheck = findings.find((f) => f.check === 'No broken navigation links');
  expect(navCheck.pass).toBe(false);
});
