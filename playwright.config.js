const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/checks',
  use: { ...devices['Desktop Chrome'] },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
