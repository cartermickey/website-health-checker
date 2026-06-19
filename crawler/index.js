const { chromium } = require('playwright');
const { get } = require('../store/audits');
const { findPageUrl } = require('./utils');
const general = require('./checks/general');
const homepage = require('./checks/homepage');
const srp = require('./checks/srp');
const vdp = require('./checks/vdp');
const specials = require('./checks/specials');
const service = require('./checks/service');
const finance = require('./checks/finance');

const PAGE_CHECKS = [
  { type: 'homepage', label: 'Homepage', module: homepage },
  { type: 'srp', label: 'SRP', module: srp },
  { type: 'vdp', label: 'VDP', module: vdp },
  { type: 'specials', label: 'Specials', module: specials },
  { type: 'service', label: 'Service', module: service },
  { type: 'finance', label: 'Finance', module: finance },
];

const AUDIT_TIMEOUT_MS = 10 * 60 * 1000;

async function runAudit(auditId, siteUrl) {
  const audit = get(auditId);
  if (!audit) throw new Error(`Audit ${auditId} not found`);

  const emit = (event) => {
    if (audit.emit) {
      audit.emit(event);
    } else {
      audit.queue.push(event);
    }
  };
  const browser = await chromium.launch({ headless: true });
  const timeoutId = setTimeout(() => browser.close().catch(() => {}), AUDIT_TIMEOUT_MS);

  let passed = 0;
  let failed = 0;

  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });

    for (const { type, label, module: mod } of PAGE_CHECKS) {
      emit({ type: 'progress', page: label, message: `Locating ${label} page...` });

      const page = await context.newPage();

      let pageUrl;
      if (type === 'homepage') {
        pageUrl = siteUrl;
      } else {
        pageUrl = await findPageUrl(page, siteUrl, type).catch(() => null);
      }

      if (!pageUrl) {
        emit({ type: 'finding', page: label, check: `${label} page found`, pass: false, reason: 'Could not locate page URL' });
        failed++;
        await page.close();
        continue;
      }

      // General checks (reloads the page inside general.runChecks)
      emit({ type: 'progress', page: label, message: `Running general checks on ${label}...` });
      const generalFindings = await general.runChecks(page, pageUrl).catch((err) => [
        { check: 'General checks', pass: false, reason: 'Unexpected error: ' + err.message },
      ]);
      for (const f of generalFindings) {
        emit({ type: 'finding', page: label, ...f });
        f.pass ? passed++ : failed++;
      }

      // Page-specific checks (page already loaded from general.runChecks)
      emit({ type: 'progress', page: label, message: `Running ${label}-specific checks...` });
      const specificFindings = await mod.runChecks(page, siteUrl).catch((err) => [
        { check: `${label} checks`, pass: false, reason: 'Unexpected error: ' + err.message },
      ]);
      for (const f of specificFindings) {
        emit({ type: 'finding', page: label, ...f });
        f.pass ? passed++ : failed++;
      }

      await page.close();
    }

    emit({ type: 'done', summary: { passed, failed } });
  } catch (err) {
    emit({ type: 'error', message: err.message });
  } finally {
    clearTimeout(timeoutId);
    await browser.close().catch(() => {});
  }
}

module.exports = { runAudit };
