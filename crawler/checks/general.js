async function runChecks(page, pageUrl, requestFn = null) {
  const httpGet = requestFn || ((url) => page.request.get(url, { timeout: 5000 }));
  const findings = [];

  // Load time
  const start = Date.now();
  try {
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (err) {
    return [{ check: 'Page loads under 3 seconds', pass: false, reason: 'Page unreachable: ' + err.message }];
  }
  const loadTime = Date.now() - start;
  findings.push({
    check: 'Page loads under 3 seconds',
    pass: loadTime < 3000,
    reason: loadTime >= 3000 ? `Loaded in ${loadTime}ms` : null,
  });

  // Broken images — use server-side request client to avoid CORS issues with CDN images
  const imgSrcs = await page.$$eval('img[src]', (imgs) => imgs.map((i) => i.src)).catch(() => []);
  const brokenImages = [];
  for (const src of imgSrcs.slice(0, 30)) { // cap at 30 to avoid long audits
    if (!src || src.startsWith('data:')) continue;
    try {
      const res = await httpGet(src);
      if (res.status() >= 400) brokenImages.push(src);
    } catch {
      brokenImages.push(src);
    }
  }
  findings.push({
    check: 'No broken images',
    pass: brokenImages.length === 0,
    reason: brokenImages.length > 0 ? `${brokenImages.length} broken image(s): ${brokenImages.slice(0, 2).join(', ')}` : null,
  });

  // Broken nav links (internal only) — use server-side request client to avoid CORS issues
  const origin = new URL(pageUrl).origin;
  const navHrefs = await page.$$eval('nav a[href], header a[href]', (els) =>
    els.map((el) => el.href).filter((h) => h && !h.startsWith('javascript:') && !h.startsWith('tel:') && !h.startsWith('mailto:'))
  ).catch(() => []);

  const internalNavHrefs = [...new Set(navHrefs.filter((h) => h.startsWith(origin)))];
  const brokenLinks = [];
  for (const href of internalNavHrefs.slice(0, 20)) {
    try {
      const res = await httpGet(href);
      if (res.status() >= 400) brokenLinks.push(href);
    } catch {
      brokenLinks.push(href);
    }
  }
  findings.push({
    check: 'No broken navigation links',
    pass: brokenLinks.length === 0,
    reason: brokenLinks.length > 0 ? `${brokenLinks.length} broken link(s): ${brokenLinks.slice(0, 2).join(', ')}` : null,
  });

  return findings;
}

module.exports = { runChecks };
