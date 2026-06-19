# Website Health Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an on-demand Node.js web app that audits Cable Dahmer dealership websites page-by-page, streaming live pass/fail results to a browser UI via Server-Sent Events.

**Architecture:** An Express server serves a static HTML/JS frontend and three API routes. When an audit is triggered, a headless Playwright browser navigates to each page type (Homepage, SRP, VDP, Specials, Service, Finance), runs targeted checks, and streams each finding to the frontend in real time. Check modules use fuzzy keyword matching to handle variation in button text and layouts across Cable Dahmer sites.

**Tech Stack:** Node.js 18+, Express 4, Playwright (headless Chromium), Vanilla HTML/CSS/JS, Server-Sent Events, `node:test` for unit tests, `@playwright/test` for browser tests

## Global Constraints

- Node.js 18+ (uses `node:test` built-in)
- CommonJS modules only (`require`/`module.exports`) — no ESM
- No TypeScript, no frontend framework, no database
- In-memory audit store only — no persistence
- Playwright for all browser automation (never raw HTTP for page checks)
- Never click submit/send buttons inside forms
- Always close modals via Escape key before moving on
- All CTA/button detection uses fuzzy keyword matching — no hardcoded exact text
- Finding shape: `{ check: string, pass: boolean, reason: string | null }`

---

## File Map

```
website-health-checker/
├── server.js                    # Express entry point — mounts routes, serves public/
├── store/
│   └── audits.js                # In-memory Map: create/get audit records
├── routes/
│   ├── sites.js                 # GET /api/sites
│   ├── audit.js                 # POST /api/audit — creates record, starts crawler async
│   └── stream.js                # GET /api/audit/:id/stream — SSE feed
├── crawler/
│   ├── index.js                 # runAudit(auditId, siteUrl) — orchestrates all checks
│   ├── utils.js                 # findPageUrl(), findElementsByKeywords(), detectPageType()
│   └── checks/
│       ├── general.js           # Load time, broken images, broken nav links
│       ├── homepage.js          # Dropdowns, CTAs, rotators, chat widget
│       ├── srp.js               # Pricing, sort, filters, locations, CTAs
│       ├── vdp.js               # CTA modals (trade/payment/prequalify/test drive), vehicle details, images
│       ├── specials.js          # Specials listings, CTA navigation
│       ├── service.js           # Appointment scheduler loads and is interactive
│       └── finance.js           # Prequalification and finance forms load
├── public/
│   ├── index.html               # Site dropdown, Run Audit button, live results panel
│   ├── app.js                   # SSE listener, DOM updates, summary rendering
│   └── styles.css               # Layout and result styling
├── tests/
│   ├── utils.test.js            # node:test unit tests for crawler/utils.js
│   └── checks/
│       ├── general.test.js      # @playwright/test — uses page.route() to mock navigation
│       ├── homepage.test.js
│       ├── srp.test.js
│       ├── vdp.test.js
│       ├── specials.test.js
│       ├── service.test.js
│       └── finance.test.js
├── package.json
└── .gitignore
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `server.js`
- Create: `.gitignore`
- Create: `public/index.html` (placeholder)

**Interfaces:**
- Produces: `npm start` starts Express on port 3000, serves `public/`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "website-health-checker",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test:unit": "node --test tests/utils.test.js",
    "test:browser": "npx playwright test tests/checks/",
    "test": "npm run test:unit && npm run test:browser"
  },
  "dependencies": {
    "express": "^4.18.2",
    "playwright": "^1.40.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0"
  }
}
```

- [ ] **Step 2: Create `server.js`**

```javascript
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Health checker running at http://localhost:${PORT}`));

module.exports = app;
```

- [ ] **Step 3: Create `public/index.html` (placeholder)**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cable Dahmer Website Health Checker</title>
</head>
<body>
  <h1>Health Checker</h1>
  <p>Coming soon.</p>
</body>
</html>
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
.playwright/
playwright-report/
test-results/
```

- [ ] **Step 5: Create `playwright.config.js`**

```javascript
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/checks',
  use: { ...devices['Desktop Chrome'] },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

- [ ] **Step 6: Install dependencies**

Run: `npm install && npx playwright install chromium`

Expected: `node_modules/` created, Chromium downloaded

- [ ] **Step 7: Verify server starts**

Run: `npm start`

Expected output: `Health checker running at http://localhost:3000`

Open `http://localhost:3000` — should see "Health Checker / Coming soon."

- [ ] **Step 8: Commit**

```bash
git add package.json server.js .gitignore public/index.html playwright.config.js
git commit -m "feat: project scaffold — express server + static file serving"
```

---

### Task 2: Audit Store + Sites Route

**Files:**
- Create: `store/audits.js`
- Create: `routes/sites.js`
- Modify: `server.js` — mount routes

**Interfaces:**
- Produces: `audits.create(url)` → `string` (auditId)
- Produces: `audits.get(id)` → `{ id, url, status, emit }` | `undefined`
- Produces: `GET /api/sites` → `[{ name: string, url: string }]`

- [ ] **Step 1: Create `store/audits.js`**

```javascript
const store = new Map();

function create(url) {
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  store.set(id, { id, url, status: 'pending', emit: null });
  return id;
}

function get(id) {
  return store.get(id);
}

module.exports = { create, get };
```

- [ ] **Step 2: Create `routes/sites.js`**

> Update this list with the actual Cable Dahmer site URLs before deploying.

```javascript
const express = require('express');
const router = express.Router();

const SITES = [
  { name: 'Cable Dahmer Chevrolet', url: 'https://www.cabledahmerchevrolet.com' },
  { name: 'Cable Dahmer Honda', url: 'https://www.cabledahmerhonda.com' },
  { name: 'Cable Dahmer Cadillac', url: 'https://www.cabledahmercadillac.com' },
  { name: 'Cable Dahmer Buick GMC', url: 'https://www.cabledahmerbuickgmc.com' },
];

router.get('/', (req, res) => res.json(SITES));

module.exports = router;
```

- [ ] **Step 3: Mount routes in `server.js`**

Replace `server.js` with:

```javascript
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/sites', require('./routes/sites'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Health checker running at http://localhost:${PORT}`));

module.exports = app;
```

- [ ] **Step 4: Verify sites route**

Run: `npm start`

In a new terminal: `curl http://localhost:3000/api/sites`

Expected: JSON array with name/url objects

- [ ] **Step 5: Commit**

```bash
git add store/audits.js routes/sites.js server.js
git commit -m "feat: audit store + GET /api/sites"
```

---

### Task 3: POST /api/audit + SSE Stream

**Files:**
- Create: `routes/audit.js`
- Create: `routes/stream.js`
- Modify: `server.js` — mount new routes

**Interfaces:**
- Consumes: `audits.create(url)`, `audits.get(id)` from `store/audits.js`
- Produces: `POST /api/audit { url }` → `{ auditId: string }`
- Produces: `GET /api/audit/:id/stream` → SSE stream, sets `audit.emit` function

- [ ] **Step 1: Create `routes/audit.js`**

```javascript
const express = require('express');
const router = express.Router();
const audits = require('../store/audits');

router.post('/', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const auditId = audits.create(url);
  res.json({ auditId });
});

module.exports = router;
```

- [ ] **Step 2: Create `routes/stream.js`**

```javascript
const express = require('express');
const router = express.Router();
const audits = require('../store/audits');

router.get('/:id/stream', (req, res) => {
  const audit = audits.get(req.params.id);
  if (!audit) return res.status(404).json({ error: 'Audit not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  audit.emit = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  req.on('close', () => {
    audit.emit = null;
  });
});

module.exports = router;
```

- [ ] **Step 3: Mount new routes in `server.js`**

```javascript
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/sites', require('./routes/sites'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/audit', require('./routes/stream'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Health checker running at http://localhost:${PORT}`));

module.exports = app;
```

- [ ] **Step 4: Verify POST and SSE in two terminals**

Terminal 1: `npm start`

Terminal 2:
```bash
curl -s -X POST http://localhost:3000/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```
Expected: `{"auditId":"audit_..."}`

Copy the auditId, then:
```bash
curl -N http://localhost:3000/api/audit/<auditId>/stream
```
Expected: connection stays open (SSE stream ready)

- [ ] **Step 5: Commit**

```bash
git add routes/audit.js routes/stream.js server.js
git commit -m "feat: POST /api/audit + SSE stream endpoint"
```

---

### Task 4: Crawler Utilities

**Files:**
- Create: `crawler/utils.js`
- Create: `tests/utils.test.js`

**Interfaces:**
- Produces: `findPageUrl(page, siteUrl, pageType)` → `Promise<string | null>`
- Produces: `findElementsByKeywords(page, keywords, selectors?)` → `Promise<ElementHandle[]>`
- Produces: `detectPageType(url)` → `'homepage' | 'srp' | 'vdp' | 'specials' | 'service' | 'finance' | 'unknown'`

- [ ] **Step 1: Write failing unit tests in `tests/utils.test.js`**

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { detectPageType } = require('../crawler/utils');

test('detectPageType - homepage', () => {
  assert.equal(detectPageType('https://example.com/'), 'homepage');
  assert.equal(detectPageType('https://example.com'), 'homepage');
});

test('detectPageType - srp', () => {
  assert.equal(detectPageType('https://example.com/new-vehicles'), 'srp');
  assert.equal(detectPageType('https://example.com/inventory'), 'srp');
});

test('detectPageType - vdp', () => {
  assert.equal(detectPageType('https://example.com/vehicles/2024-honda-civic-abc123'), 'vdp');
});

test('detectPageType - specials', () => {
  assert.equal(detectPageType('https://example.com/specials'), 'specials');
  assert.equal(detectPageType('https://example.com/offers'), 'specials');
});

test('detectPageType - service', () => {
  assert.equal(detectPageType('https://example.com/service'), 'service');
});

test('detectPageType - finance', () => {
  assert.equal(detectPageType('https://example.com/finance'), 'finance');
  assert.equal(detectPageType('https://example.com/financing'), 'finance');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit`

Expected: FAIL — `Cannot find module '../crawler/utils'`

- [ ] **Step 3: Create `crawler/utils.js`**

```javascript
const PAGE_TYPE_PATTERNS = {
  srp: ['/new-vehicles', '/new', '/inventory', '/vehicles', '/used-vehicles', '/used', '/certified'],
  specials: ['/specials', '/specials/new', '/offers', '/special-offers', '/current-offers'],
  service: ['/service', '/service-department', '/schedule-service', '/service-center'],
  finance: ['/finance', '/financing', '/apply', '/get-financed', '/credit-application'],
};

const PAGE_TYPE_NAV_KEYWORDS = {
  srp: ['inventory', 'vehicles', 'new vehicles', 'used vehicles', 'shop vehicles'],
  specials: ['specials', 'offers', 'deals', 'incentives'],
  service: ['service', 'maintenance', 'repair', 'schedule service'],
  finance: ['finance', 'financing', 'credit', 'apply', 'payment'],
};

function detectPageType(url) {
  let path;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return 'unknown';
  }

  if (path === '/' || path === '' || path === '/index.html') return 'homepage';

  if (/\/(specials|offers|deals|incentives)/.test(path)) return 'specials';
  if (/\/(service|parts|maintenance|schedule-service)/.test(path)) return 'service';
  if (/\/(finance|financing|credit|apply|prequalif)/.test(path)) return 'finance';

  if (/\/(new|used|certified|inventory|vehicles|srp)/.test(path)) {
    // VDP URLs typically have 4+ path segments or contain a VIN-like segment
    const segments = path.split('/').filter(Boolean);
    if (segments.length >= 4 || /[A-Z0-9]{17}/i.test(path) || /\d{4}[-_]/.test(path)) return 'vdp';
    return 'srp';
  }

  return 'unknown';
}

async function findPageUrl(page, siteUrl, pageType) {
  const base = new URL(siteUrl).origin;

  if (pageType === 'vdp') {
    // Discover VDP by navigating to SRP first
    const srpUrl = await findPageUrl(page, siteUrl, 'srp');
    if (!srpUrl) return null;
    try {
      await page.goto(srpUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const link = await page.$('a[href*="/vehicles/"], a[href*="/vdp/"], a[href*="/inventory/"][href!="' + srpUrl + '"]');
      if (link) {
        const href = await link.getAttribute('href');
        return href.startsWith('http') ? href : new URL(href, srpUrl).href;
      }
    } catch {
      return null;
    }
    return null;
  }

  const patterns = PAGE_TYPE_PATTERNS[pageType];
  if (!patterns) return null;

  // Try known URL patterns first
  for (const pattern of patterns) {
    const url = `${base}${pattern}`;
    try {
      const response = await page.request.get(url, { timeout: 8000 });
      if (response.ok()) return url;
    } catch {
      continue;
    }
  }

  // Fall back to nav link discovery
  try {
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const links = await page.$$eval('nav a[href], header a[href]', (els) =>
      els.map((el) => ({ href: el.href, text: el.textContent.trim().toLowerCase() }))
    );
    const keywords = PAGE_TYPE_NAV_KEYWORDS[pageType] || [];
    for (const link of links) {
      if (keywords.some((kw) => link.text.includes(kw) || link.href.includes(kw.replace(/ /g, '-')))) {
        return link.href;
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function findElementsByKeywords(page, keywords, selectors = ['button', 'a', '[role="button"]']) {
  const selector = selectors.join(', ');
  const elements = await page.$$(selector);
  const matches = [];

  for (const el of elements) {
    const text = (await el.textContent().catch(() => '')).toLowerCase();
    const ariaLabel = (await el.getAttribute('aria-label').catch(() => '') || '').toLowerCase();
    const combined = `${text} ${ariaLabel}`;
    if (keywords.some((kw) => combined.includes(kw.toLowerCase()))) {
      matches.push(el);
    }
  }

  return matches;
}

module.exports = { detectPageType, findPageUrl, findElementsByKeywords };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit`

Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add crawler/utils.js tests/utils.test.js
git commit -m "feat: crawler utilities — page type detection, fuzzy element finder, page URL discovery"
```

---

### Task 5: General Checks Module

**Files:**
- Create: `crawler/checks/general.js`
- Create: `tests/checks/general.test.js`

**Interfaces:**
- Consumes: `page` (Playwright Page), `pageUrl` (string)
- Produces: `runChecks(page, pageUrl)` → `Promise<Finding[]>`
  - Finding: `{ check: string, pass: boolean, reason: string | null }`

- [ ] **Step 1: Write failing test in `tests/checks/general.test.js`**

> `general.runChecks` calls `page.goto()` internally, so use `page.route()` to intercept
> the navigation — `page.setContent()` would be overwritten by the internal goto.

```javascript
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
```

- [ ] **Step 2: Run to verify tests fail**

Run: `npx playwright test tests/checks/general.test.js`

Expected: FAIL — `Cannot find module '../../crawler/checks/general'`

- [ ] **Step 3: Create `crawler/checks/general.js`**

```javascript
async function runChecks(page, pageUrl) {
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

  // Broken images
  const imgSrcs = await page.$$eval('img[src]', (imgs) => imgs.map((i) => i.src)).catch(() => []);
  const brokenImages = [];
  for (const src of imgSrcs.slice(0, 30)) { // cap at 30 to avoid long audits
    if (!src || src.startsWith('data:')) continue;
    try {
      const res = await page.request.get(src, { timeout: 5000 });
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

  // Broken nav links (internal only)
  const origin = new URL(pageUrl).origin;
  const navHrefs = await page.$$eval('nav a[href], header a[href]', (els) =>
    els.map((el) => el.href).filter((h) => h && !h.startsWith('javascript:') && !h.startsWith('tel:') && !h.startsWith('mailto:'))
  ).catch(() => []);

  const internalNavHrefs = [...new Set(navHrefs.filter((h) => h.startsWith(origin)))];
  const brokenLinks = [];
  for (const href of internalNavHrefs.slice(0, 20)) {
    try {
      const res = await page.request.get(href, { timeout: 8000 });
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test tests/checks/general.test.js`

Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add crawler/checks/general.js tests/checks/general.test.js
git commit -m "feat: general checks — load time, broken images, broken nav links"
```

---

### Task 6: Homepage Checks Module

**Files:**
- Create: `crawler/checks/homepage.js`
- Create: `tests/checks/homepage.test.js`

**Interfaces:**
- Consumes: `findElementsByKeywords` from `crawler/utils.js`
- Produces: `runChecks(page, siteUrl)` → `Promise<Finding[]>`

- [ ] **Step 1: Write failing test in `tests/checks/homepage.test.js`**

```javascript
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
```

- [ ] **Step 2: Run to verify tests fail**

Run: `npx playwright test tests/checks/homepage.test.js`

Expected: FAIL

- [ ] **Step 3: Create `crawler/checks/homepage.js`**

```javascript
const { findElementsByKeywords } = require('../utils');

async function runChecks(page, siteUrl) {
  const findings = [];

  // Shop by Vehicle dropdowns
  const dropdownTriggers = await findElementsByKeywords(
    page,
    ['shop by', 'shop vehicles', 'vehicle type', 'make', 'model', 'type'],
    ['button', 'select', '[role="combobox"]', '[class*="dropdown"]']
  );
  let dropdownWorking = false;
  for (const trigger of dropdownTriggers) {
    try {
      await trigger.click();
      await page.waitForTimeout(500);
      const openMenu = await page.$('[class*="dropdown-menu"]:visible, [class*="dropdown-content"]:visible, select option');
      if (openMenu) { dropdownWorking = true; break; }
    } catch { continue; }
  }
  findings.push({
    check: 'Shop by Vehicle dropdowns open',
    pass: dropdownWorking || dropdownTriggers.length === 0, // pass if no dropdowns found (site may not have them)
    reason: !dropdownWorking && dropdownTriggers.length > 0 ? 'Dropdown did not open on click' : null,
  });

  // CTAs navigate correctly
  const ctaLinks = await findElementsByKeywords(
    page,
    ['shop', 'view', 'inventory', 'explore', 'browse', 'get started'],
    ['a[href]']
  );
  let ctaWorking = ctaLinks.length === 0;
  for (const cta of ctaLinks.slice(0, 3)) {
    const href = await cta.getAttribute('href').catch(() => null);
    if (href && href !== '/' && !href.startsWith('#')) { ctaWorking = true; break; }
  }
  findings.push({
    check: 'CTAs have valid navigation targets',
    pass: ctaWorking,
    reason: !ctaWorking ? 'CTA links found but none have valid href targets' : null,
  });

  // Rotators
  const rotators = await page.$$('[class*="rotator"] a, [class*="slider"] a, [class*="banner"] a, [class*="carousel"] a').catch(() => []);
  let rotatorWorking = rotators.length === 0;
  for (const r of rotators.slice(0, 2)) {
    const href = await r.getAttribute('href').catch(() => null);
    if (href && href !== '#' && !href.startsWith('javascript:')) { rotatorWorking = true; break; }
  }
  findings.push({
    check: 'Rotators have valid navigation targets',
    pass: rotatorWorking,
    reason: !rotatorWorking && rotators.length > 0 ? 'Rotator links found but none navigate' : null,
  });

  // Chat widget
  const chatWidget = await page.$(
    '[id*="chat"], [class*="chat"], [class*="livechat"], [id*="livechat"], ' +
    '[class*="drift"], [class*="intercom"], iframe[src*="chat"], iframe[src*="live"]'
  ).catch(() => null);
  const chatVisible = chatWidget ? await chatWidget.isVisible().catch(() => false) : false;
  findings.push({
    check: 'Chat widget visible',
    pass: chatVisible,
    reason: !chatVisible ? 'Chat widget not found or not visible' : null,
  });

  return findings;
}

module.exports = { runChecks };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test tests/checks/homepage.test.js`

Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add crawler/checks/homepage.js tests/checks/homepage.test.js
git commit -m "feat: homepage checks — dropdowns, CTAs, rotators, chat widget"
```

---

### Task 7: SRP Checks Module

**Files:**
- Create: `crawler/checks/srp.js`
- Create: `tests/checks/srp.test.js`

**Interfaces:**
- Produces: `runChecks(page, siteUrl)` → `Promise<Finding[]>`

- [ ] **Step 1: Write failing test in `tests/checks/srp.test.js`**

```javascript
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
```

- [ ] **Step 2: Run to verify tests fail**

Run: `npx playwright test tests/checks/srp.test.js`

Expected: FAIL

- [ ] **Step 3: Create `crawler/checks/srp.js`**

```javascript
const { findElementsByKeywords } = require('../utils');

async function runChecks(page, siteUrl) {
  const findings = [];

  // Pricing visible
  const priceEl = await page.$(
    '[class*="price"]:not([class*="msrp-label"]), [data-price], [itemprop="price"], ' +
    '[class*="vehicle-price"], [class*="listing-price"]'
  ).catch(() => null);
  const priceText = priceEl ? await priceEl.textContent().catch(() => '') : '';
  const hasPrice = /\$[\d,]+/.test(priceText);
  findings.push({
    check: 'Listings display pricing',
    pass: hasPrice,
    reason: !hasPrice ? 'No price element with dollar amount found on listings' : null,
  });

  // Sort by Price Low to High
  const sortTriggers = await findElementsByKeywords(
    page,
    ['price', 'low to high', 'sort'],
    ['select', 'button', '[class*="sort"]', '[role="option"]']
  );
  let sortWorking = false;
  for (const trigger of sortTriggers.slice(0, 2)) {
    try {
      const tagName = await trigger.evaluate((el) => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await trigger.selectOption({ label: /price.*low/i });
      } else {
        await trigger.click();
        await page.waitForTimeout(800);
        const opt = await findElementsByKeywords(page, ['price: low', 'low to high'], ['option', 'li', '[role="option"]']);
        if (opt.length > 0) await opt[0].click();
      }
      await page.waitForTimeout(1000);
      sortWorking = true;
      break;
    } catch { continue; }
  }
  findings.push({
    check: 'Sort "Price: Low to High" works',
    pass: sortWorking || sortTriggers.length === 0,
    reason: !sortWorking && sortTriggers.length > 0 ? 'Sort control found but could not apply sort' : null,
  });

  // Filters update results
  const filterInputs = await page.$$(
    '[class*="filter"] input[type="checkbox"], [class*="filter"] select, ' +
    '[class*="facet"] input, [class*="sidebar"] input[type="checkbox"]'
  ).catch(() => []);
  let filtersWorking = filterInputs.length === 0;
  if (filterInputs.length > 0) {
    const countBefore = await page.$$eval('[class*="vehicle-card"], [class*="listing-item"], [class*="inventory-item"]', (els) => els.length).catch(() => 0);
    try {
      await filterInputs[0].click();
      await page.waitForTimeout(1500);
      const countAfter = await page.$$eval('[class*="vehicle-card"], [class*="listing-item"], [class*="inventory-item"]', (els) => els.length).catch(() => 0);
      filtersWorking = countAfter !== countBefore;
    } catch { /* filter interaction failed */ }
  }
  findings.push({
    check: 'Filters update results',
    pass: filtersWorking,
    reason: !filtersWorking && filterInputs.length > 0 ? 'Filter clicked but results did not change' : null,
  });

  // Dealership locations listed
  const locationEls = await findElementsByKeywords(
    page,
    ['location', 'dealership', 'store', 'cable dahmer'],
    ['select option', 'li', '[class*="location"]', '[class*="dealer"]']
  );
  findings.push({
    check: 'Dealership locations listed',
    pass: locationEls.length > 0,
    reason: locationEls.length === 0 ? 'No location/dealership selector found' : null,
  });

  // CTAs present on listings
  const ctaEls = await findElementsByKeywords(
    page,
    ['view details', 'details', 'more info', 'check availability', 'get price'],
    ['a', 'button']
  );
  findings.push({
    check: 'Expected CTAs present on listings',
    pass: ctaEls.length > 0,
    reason: ctaEls.length === 0 ? 'No CTA buttons/links found on listing cards' : null,
  });

  return findings;
}

module.exports = { runChecks };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test tests/checks/srp.test.js`

Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add crawler/checks/srp.js tests/checks/srp.test.js
git commit -m "feat: SRP checks — pricing, sort, filters, locations, CTAs"
```

---

### Task 8: VDP Checks Module

**Files:**
- Create: `crawler/checks/vdp.js`
- Create: `tests/checks/vdp.test.js`

**Interfaces:**
- Produces: `runChecks(page, siteUrl)` → `Promise<Finding[]>`

- [ ] **Step 1: Write failing test in `tests/checks/vdp.test.js`**

```javascript
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
```

- [ ] **Step 2: Run to verify tests fail**

Run: `npx playwright test tests/checks/vdp.test.js`

Expected: FAIL

- [ ] **Step 3: Create `crawler/checks/vdp.js`**

```javascript
const { findElementsByKeywords } = require('../utils');

async function tryModalCTA(page, keywords, checkName) {
  const triggers = await findElementsByKeywords(page, keywords, ['button', 'a', '[role="button"]']);
  if (triggers.length === 0) {
    return { check: checkName, pass: false, reason: 'Button not found on page' };
  }
  for (const trigger of triggers) {
    try {
      await trigger.click();
      const modal = await page.waitForSelector(
        '[class*="modal"]:visible, [class*="dialog"]:visible, [class*="overlay"]:visible, ' +
        '[role="dialog"]:visible, [class*="drawer"]:visible',
        { timeout: 3000 }
      );
      if (modal) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        return { check: checkName, pass: true, reason: null };
      }
    } catch { continue; }
  }
  return { check: checkName, pass: false, reason: 'Button clicked but no modal appeared within 3s' };
}

async function runChecks(page, siteUrl) {
  const findings = [];

  findings.push(await tryModalCTA(page, ['value your trade', 'trade', 'trade-in', 'trade in', 'get trade'], '"Value Your Trade" modal opens'));
  findings.push(await tryModalCTA(page, ['calculate', 'payment', 'monthly payment', 'estimate payment'], '"Calculate Your Payment" modal opens'));
  findings.push(await tryModalCTA(page, ['prequalif', 'pre-qualif', 'get qualified', 'credit', 'financing'], '"Get Prequalified" modal opens'));
  findings.push(await tryModalCTA(page, ['test drive', 'schedule', 'schedule a test drive', 'book a test drive'], '"Schedule a Test Drive" modal opens'));

  // Vehicle price
  const priceEl = await page.$('[class*="price"], [data-price], [itemprop="price"]').catch(() => null);
  const priceText = priceEl ? await priceEl.textContent().catch(() => '') : '';
  findings.push({
    check: 'Vehicle price is present',
    pass: /\$[\d,]+/.test(priceText),
    reason: !/\$[\d,]+/.test(priceText) ? 'No price element with dollar amount found' : null,
  });

  // VIN
  const vinEl = await page.$('[class*="vin"], [data-vin], [itemprop="vehicleIdentificationNumber"]').catch(() => null);
  const vinText = vinEl ? await vinEl.textContent().catch(() => '') : '';
  const bodyText = await page.textContent('body').catch(() => '');
  const vinMatch = vinText.match(/[A-HJ-NPR-Z0-9]{17}/i) || bodyText.match(/VIN[:\s]+([A-HJ-NPR-Z0-9]{17})/i);
  findings.push({
    check: 'VIN is present',
    pass: !!vinMatch,
    reason: !vinMatch ? 'No VIN found on page' : null,
  });

  // Stock number
  const stockEl = await page.$('[class*="stock"], [data-stock]').catch(() => null);
  const stockText = stockEl ? await stockEl.textContent().catch(() => '') : '';
  const hasStock = stockText.trim().length > 0 || /stock[:\s#]+\S+/i.test(bodyText);
  findings.push({
    check: 'Stock number is present',
    pass: hasStock,
    reason: !hasStock ? 'No stock number found on page' : null,
  });

  // Images
  const imgSrcs = await page.$$eval('img[src]', (imgs) =>
    imgs.map((i) => i.src).filter((s) => !s.startsWith('data:'))
  ).catch(() => []);
  const brokenImages = [];
  for (const src of imgSrcs.slice(0, 20)) {
    try {
      const res = await page.request.get(src, { timeout: 5000 });
      if (res.status() >= 400) brokenImages.push(src);
    } catch { brokenImages.push(src); }
  }
  findings.push({
    check: 'All vehicle images load',
    pass: brokenImages.length === 0,
    reason: brokenImages.length > 0 ? `${brokenImages.length} broken image(s)` : null,
  });

  return findings;
}

module.exports = { runChecks };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test tests/checks/vdp.test.js`

Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add crawler/checks/vdp.js tests/checks/vdp.test.js
git commit -m "feat: VDP checks — CTA modals, vehicle details, images"
```

---

### Task 9: Specials, Service, and Finance Checks

**Files:**
- Create: `crawler/checks/specials.js`
- Create: `crawler/checks/service.js`
- Create: `crawler/checks/finance.js`
- Create: `tests/checks/specials.test.js`
- Create: `tests/checks/service.test.js`
- Create: `tests/checks/finance.test.js`

**Interfaces:**
- Each exports: `runChecks(page, siteUrl)` → `Promise<Finding[]>`

- [ ] **Step 1: Write failing tests**

`tests/checks/specials.test.js`:
```javascript
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
```

`tests/checks/service.test.js`:
```javascript
const { test, expect } = require('@playwright/test');
const { runChecks } = require('../../crawler/checks/service');

test('fails when scheduler is missing', async ({ page }) => {
  await page.setContent(`<html><body><p>No scheduler here</p></body></html>`, { url: 'https://example.com/service' });
  const findings = await runChecks(page, 'https://example.com/');
  const schedulerCheck = findings.find((f) => f.check === 'Appointment scheduler loads');
  expect(schedulerCheck.pass).toBe(false);
});
```

`tests/checks/finance.test.js`:
```javascript
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
```

- [ ] **Step 2: Run to verify tests fail**

Run: `npx playwright test tests/checks/specials.test.js tests/checks/service.test.js tests/checks/finance.test.js`

Expected: FAIL

- [ ] **Step 3: Create `crawler/checks/specials.js`**

```javascript
const { findElementsByKeywords } = require('../utils');

async function runChecks(page, siteUrl) {
  const findings = [];
  const pageUrl = page.url();
  const isNew = /new/i.test(pageUrl);
  const isUsed = /used|pre.?owned/i.test(pageUrl);
  const label = isNew ? 'New' : isUsed ? 'Pre-Owned' : 'Specials';

  const listingEls = await page.$$(
    '[class*="special"], [class*="offer"], [class*="deal"], [class*="incentive"], ' +
    '[class*="promo"], [class*="vehicle-card"]'
  ).catch(() => []);
  findings.push({
    check: `${label} specials listings display`,
    pass: listingEls.length > 0,
    reason: listingEls.length === 0 ? 'No specials/offers listings found on page' : null,
  });

  // CTAs link to VDP or offer page
  const ctaLinks = await findElementsByKeywords(
    page,
    ['view', 'details', 'get deal', 'claim', 'see offer', 'shop now'],
    ['a[href]']
  );
  let ctaValid = ctaLinks.length === 0;
  for (const link of ctaLinks.slice(0, 3)) {
    const href = await link.getAttribute('href').catch(() => null);
    if (href && href !== '#' && !href.startsWith('javascript:')) { ctaValid = true; break; }
  }
  findings.push({
    check: 'Specials CTAs navigate to VDP or offer page',
    pass: ctaValid,
    reason: !ctaValid && ctaLinks.length > 0 ? 'Specials CTA links have no valid targets' : null,
  });

  return findings;
}

module.exports = { runChecks };
```

- [ ] **Step 4: Create `crawler/checks/service.js`**

```javascript
async function runChecks(page, siteUrl) {
  const findings = [];

  const scheduler = await page.$(
    'iframe[src*="schedule"], iframe[src*="appointment"], iframe[src*="service"], ' +
    '[class*="scheduler"], [class*="appointment"], [id*="scheduler"], [id*="appointment"], ' +
    'form[action*="appointment"], form[action*="schedule"]'
  ).catch(() => null);
  const schedulerVisible = scheduler ? await scheduler.isVisible().catch(() => false) : false;

  findings.push({
    check: 'Appointment scheduler loads',
    pass: schedulerVisible,
    reason: !schedulerVisible ? 'Scheduler widget or iframe not found/visible' : null,
  });

  if (schedulerVisible) {
    let interactive = false;
    try {
      const input = await page.$('input[type="text"], input[type="date"], select, [class*="date-picker"]');
      if (input) { interactive = await input.isEnabled(); }
    } catch { /* ignore */ }
    findings.push({
      check: 'Scheduler is interactive',
      pass: interactive,
      reason: !interactive ? 'Scheduler found but no interactive inputs detected' : null,
    });
  }

  return findings;
}

module.exports = { runChecks };
```

- [ ] **Step 5: Create `crawler/checks/finance.js`**

```javascript
async function runChecks(page, siteUrl) {
  const findings = [];

  const prequalForm = await page.$(
    'form[id*="prequal"], form[class*="prequal"], ' +
    'iframe[src*="prequal"], iframe[src*="credit"], ' +
    '[class*="prequal"], [id*="prequal"]'
  ).catch(() => null);
  const prequalVisible = prequalForm
    ? await prequalForm.isVisible().catch(() => false)
    : await page.$('input[placeholder*="name" i], input[name*="first"]').then((el) => el ? el.isVisible() : false).catch(() => false);

  findings.push({
    check: 'Prequalification form displays',
    pass: prequalVisible,
    reason: !prequalVisible ? 'Prequalification form or fields not found/visible' : null,
  });

  const financeForm = await page.$(
    'form[id*="finance"], form[class*="finance"], ' +
    'iframe[src*="finance"], iframe[src*="RouteOne"], iframe[src*="dealertrack"], ' +
    '[class*="finance-app"], [id*="credit-app"]'
  ).catch(() => null);
  const financeVisible = financeForm ? await financeForm.isVisible().catch(() => false) : false;

  findings.push({
    check: 'Finance Application form displays',
    pass: financeVisible,
    reason: !financeVisible ? 'Finance application form or iframe not found/visible' : null,
  });

  return findings;
}

module.exports = { runChecks };
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx playwright test tests/checks/specials.test.js tests/checks/service.test.js tests/checks/finance.test.js`

Expected: 3 tests PASS

- [ ] **Step 7: Commit**

```bash
git add crawler/checks/specials.js crawler/checks/service.js crawler/checks/finance.js \
        tests/checks/specials.test.js tests/checks/service.test.js tests/checks/finance.test.js
git commit -m "feat: specials, service, and finance checks"
```

---

### Task 10: Crawler Orchestrator

**Files:**
- Create: `crawler/index.js`
- Modify: `routes/audit.js` — call `runAudit` after creating record

**Interfaces:**
- Consumes: `audits.get(id)` → audit record with `.emit` function
- Consumes: all check modules via `runChecks(page, siteUrl)`
- Consumes: `findPageUrl(page, siteUrl, type)` from `crawler/utils.js`
- Produces: `runAudit(auditId, siteUrl)` → `Promise<void>` — emits SSE events throughout

- [ ] **Step 1: Create `crawler/index.js`**

```javascript
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

  const emit = (event) => { if (audit.emit) audit.emit(event); };
  const browser = await chromium.launch({ headless: true });
  const timeoutId = setTimeout(() => browser.close().catch(() => {}), AUDIT_TIMEOUT_MS);

  let passed = 0;
  let failed = 0;

  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });

    for (const { type, label, module } of PAGE_CHECKS) {
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
      const generalFindings = await general.runChecks(page, pageUrl).catch(() => []);
      for (const f of generalFindings) {
        emit({ type: 'finding', page: label, ...f });
        f.pass ? passed++ : failed++;
      }

      // Page-specific checks (page already loaded from general.runChecks)
      emit({ type: 'progress', page: label, message: `Running ${label}-specific checks...` });
      const specificFindings = await module.runChecks(page, siteUrl).catch(() => []);
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
```

- [ ] **Step 2: Update `routes/audit.js` to start the crawler**

```javascript
const express = require('express');
const router = express.Router();
const audits = require('../store/audits');
const { runAudit } = require('../crawler');

router.post('/', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const auditId = audits.create(url);
  res.json({ auditId });

  // Start async — do not await
  runAudit(auditId, url).catch((err) => console.error('Audit failed:', err));
});

module.exports = router;
```

- [ ] **Step 3: Smoke test the full audit flow**

Run: `npm start`

In a second terminal, start an audit against a Cable Dahmer site:
```bash
curl -s -X POST http://localhost:3000/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.cabledahmerchevrolet.com"}' | cat
```
Copy the `auditId`, then stream it:
```bash
curl -N http://localhost:3000/api/audit/<auditId>/stream
```

Expected: SSE events appear — progress messages followed by finding events, ending with a `done` event.

- [ ] **Step 4: Commit**

```bash
git add crawler/index.js routes/audit.js
git commit -m "feat: crawler orchestrator — wires all check modules, drives SSE stream"
```

---

### Task 11: Frontend UI

**Files:**
- Modify: `public/index.html` — full UI
- Create: `public/app.js` — SSE listener, DOM updates, summary rendering
- Create: `public/styles.css` — layout and result styling

**Interfaces:**
- Consumes: `GET /api/sites` — populates dropdown
- Consumes: `POST /api/audit` — starts audit
- Consumes: `GET /api/audit/:id/stream` — receives SSE events

- [ ] **Step 1: Replace `public/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cable Dahmer Website Health Checker</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <h1>Website Health Checker</h1>
    <div class="controls">
      <select id="site-select">
        <option value="">Select a website...</option>
      </select>
      <button id="run-btn" disabled>Run Audit</button>
    </div>

    <div id="status-bar" class="status-bar hidden"></div>

    <div id="results" class="results hidden">
      <div id="summary" class="summary"></div>
      <div id="findings-list" class="findings-list"></div>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `public/app.js`**

```javascript
const siteSelect = document.getElementById('site-select');
const runBtn = document.getElementById('run-btn');
const statusBar = document.getElementById('status-bar');
const results = document.getElementById('results');
const summary = document.getElementById('summary');
const findingsList = document.getElementById('findings-list');

// Load site list
fetch('/api/sites')
  .then((r) => r.json())
  .then((sites) => {
    sites.forEach((site) => {
      const opt = document.createElement('option');
      opt.value = site.url;
      opt.textContent = site.name;
      siteSelect.appendChild(opt);
    });
  });

siteSelect.addEventListener('change', () => {
  runBtn.disabled = !siteSelect.value;
});

runBtn.addEventListener('click', startAudit);

function startAudit() {
  const url = siteSelect.value;
  if (!url) return;

  runBtn.disabled = true;
  results.classList.add('hidden');
  findingsList.innerHTML = '';
  summary.innerHTML = '';
  setStatus('Starting audit...');

  fetch('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
    .then((r) => r.json())
    .then(({ auditId }) => streamAudit(auditId))
    .catch((err) => setStatus('Error: ' + err.message));
}

function streamAudit(auditId) {
  const es = new EventSource(`/api/audit/${auditId}/stream`);
  const pageGroups = {};

  es.onmessage = (e) => {
    const event = JSON.parse(e.data);

    if (event.type === 'progress') {
      setStatus(`[${event.page}] ${event.message}`);
    }

    if (event.type === 'finding') {
      results.classList.remove('hidden');
      if (!pageGroups[event.page]) {
        pageGroups[event.page] = document.createElement('div');
        pageGroups[event.page].className = 'page-group';
        pageGroups[event.page].innerHTML = `<h2>${event.page}</h2>`;
        findingsList.appendChild(pageGroups[event.page]);
      }
      const item = document.createElement('div');
      item.className = `finding-item ${event.pass ? 'pass' : 'fail'}`;
      item.innerHTML = `
        <span class="icon">${event.pass ? '✅' : '❌'}</span>
        <span class="check-name">${event.check}</span>
        ${!event.pass && event.reason ? `<span class="reason">${event.reason}</span>` : ''}
      `;
      pageGroups[event.page].appendChild(item);
    }

    if (event.type === 'done') {
      es.close();
      runBtn.disabled = false;
      const { passed, failed } = event.summary;
      summary.innerHTML = `
        <div class="summary-box">
          <span class="summary-pass">✅ ${passed} passed</span>
          <span class="summary-fail">❌ ${failed} failed</span>
        </div>
      `;
      setStatus('Audit complete.');
    }

    if (event.type === 'error') {
      es.close();
      runBtn.disabled = false;
      setStatus('Audit error: ' + event.message);
    }
  };

  es.onerror = () => {
    es.close();
    runBtn.disabled = false;
    setStatus('Connection lost. Audit may still be running.');
  };
}

function setStatus(msg) {
  statusBar.textContent = msg;
  statusBar.classList.remove('hidden');
}
```

- [ ] **Step 3: Create `public/styles.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f5f5f5;
  color: #222;
  padding: 2rem;
}

.container { max-width: 860px; margin: 0 auto; }

h1 { font-size: 1.8rem; margin-bottom: 1.5rem; color: #1a1a2e; }

.controls {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

select {
  flex: 1;
  padding: 0.6rem 0.8rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 1rem;
}

button {
  padding: 0.6rem 1.4rem;
  background: #c8102e;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

button:disabled { background: #aaa; cursor: not-allowed; }
button:not(:disabled):hover { background: #a00d24; }

.status-bar {
  padding: 0.5rem 0.75rem;
  background: #e8f0fe;
  border-left: 4px solid #1a73e8;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #333;
  margin-bottom: 1rem;
}

.hidden { display: none; }

.summary-box {
  display: flex;
  gap: 1.5rem;
  padding: 0.75rem 1rem;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #ddd;
  margin-bottom: 1.5rem;
  font-weight: 600;
  font-size: 1.1rem;
}

.summary-pass { color: #1e8e3e; }
.summary-fail { color: #c5221f; }

.page-group { margin-bottom: 1.5rem; }
.page-group h2 {
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #555;
  margin-bottom: 0.5rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid #ddd;
}

.finding-item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.45rem 0.75rem;
  border-radius: 5px;
  margin-bottom: 0.3rem;
  font-size: 0.95rem;
}

.finding-item.pass { background: #f0faf4; }
.finding-item.fail { background: #fff0f0; }

.icon { flex-shrink: 0; }
.check-name { font-weight: 500; }
.reason { color: #c5221f; font-size: 0.85rem; margin-left: 0.25rem; }
```

- [ ] **Step 4: End-to-end test in the browser**

Run: `npm start`

Open `http://localhost:3000`

1. Select a Cable Dahmer site from the dropdown
2. Click "Run Audit"
3. Verify: status bar updates, findings appear live grouped by page type
4. Verify: summary shows passed/failed counts when done
5. Verify: "Run Audit" button re-enables after completion

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/app.js public/styles.css
git commit -m "feat: frontend UI — site dropdown, live audit stream, pass/fail results"
```

---

### Task 12: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md with final project info**

Replace the contents of `CLAUDE.md`:

```markdown
# Website Health Checker

Automated health checker for Cable Dahmer dealership websites.

## Running the Tool

```bash
npm install
npx playwright install chromium
npm start
```

Open http://localhost:3000, select a site, click Run Audit.

## Running Tests

```bash
npm run test:unit        # utils unit tests (node:test)
npm run test:browser     # check module tests (playwright/test)
npm test                 # both
```

## Adding or Updating Sites

Edit `routes/sites.js` — add `{ name, url }` entries to the `SITES` array.

## Project Structure

- `server.js` — Express entry point
- `store/audits.js` — in-memory audit store
- `routes/` — API routes (sites, audit, stream)
- `crawler/index.js` — orchestrates the full audit
- `crawler/utils.js` — fuzzy matching, page type detection, URL discovery
- `crawler/checks/` — one module per page type
- `public/` — frontend (vanilla HTML/CSS/JS)

## Design Spec

`docs/superpowers/specs/2026-06-19-health-checker-design.md`
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with final project info and run instructions"
```
