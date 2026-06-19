# Website Health Checker

On-demand health audit tool for Cable Dahmer dealership websites. Select a site, click **Run Audit**, and get a live pass/fail report streamed to the browser covering every critical page type.

## Quick Start

```bash
npm install
npx playwright install chromium
npm start
```

Open **http://localhost:3000**, select a Cable Dahmer site from the dropdown, and click **Run Audit**. Results stream in live as each page type is checked. A full audit takes 3–8 minutes depending on site speed.

## Running Tests

```bash
npm run test:unit        # utils unit tests (Node built-in test runner)
npm run test:browser     # check module tests (Playwright)
npm test                 # both suites
```

All tests are headless — no server needs to be running.

## What It Checks

Checks run on every page type:
- Page loads under 3 seconds
- No broken images
- No broken navigation links

Then page-type-specific checks:

| Page | Checks |
|------|--------|
| **Homepage** | Shop-by-vehicle dropdowns open, CTAs navigate, rotators are clickable, chat widget visible and opens |
| **SRP** | Listings show pricing, sort "Price: Low to High" works, filters update results, dealership locations listed, CTAs present |
| **VDP** | Value Your Trade / Calculate Payment / Get Prequalified / Schedule Test Drive modals open, vehicle price/VIN/stock present, all images load |
| **Specials** | New and Pre-Owned listings display, CTA links have valid targets |
| **Service** | Appointment scheduler widget loads and is interactive |
| **Finance** | Prequalification and finance application forms display |

**Button rule:** CTAs are clicked to verify modals/forms open — forms are never submitted.

## Project Structure

```
server.js                     # Express server — port 3000, serves public/
store/
  audits.js                   # In-memory audit store (Map) with SSE event queue
routes/
  sites.js                    # GET /api/sites — fixed Cable Dahmer site list
  audit.js                    # POST /api/audit — creates record, fires runAudit async
  stream.js                   # GET /api/audit/:id/stream — SSE event feed
crawler/
  index.js                    # Orchestrator — iterates page types, drives SSE stream
  utils.js                    # detectPageType, findPageUrl, findElementsByKeywords
  checks/
    general.js                # Load time, broken images, broken nav links (calls page.goto internally)
    homepage.js               # Dropdowns, CTAs, rotators, chat widget
    srp.js                    # Pricing, sort, filters, locations, CTAs
    vdp.js                    # CTA modals, vehicle details, images
    specials.js               # Specials listings, CTA navigation
    service.js                # Appointment scheduler
    finance.js                # Prequalification and finance forms
public/
  index.html                  # UI — dropdown, run button, live results panel
  app.js                      # SSE client, DOM updates, summary rendering
  styles.css                  # Layout and result styles
tests/
  utils.test.js               # Unit tests for crawler utilities
  checks/                     # Playwright tests for each check module
    general.test.js
    homepage.test.js
    srp.test.js
    vdp.test.js
    specials.test.js
    service.test.js
    finance.test.js
```

## Cable Dahmer Sites

| Site | URL |
|------|-----|
| Cable Dahmer Chevrolet | https://www.cabledahmerchevrolet.com |
| Cable Dahmer Honda | https://www.cabledahmerhonda.com |
| Cable Dahmer Cadillac | https://www.cabledahmercadillac.com |
| Cable Dahmer Buick GMC | https://www.cabledahmerbuickgmc.com |

To add a site: edit `routes/sites.js` and add `{ name, url }` to the `SITES` array.

## Architecture Notes

- **SSE event buffering** — events emitted before the stream client connects are queued in the audit store and flushed the moment the `EventSource` connects, so no findings are lost.
- **Injectable requestFn** — `general.js` accepts an optional HTTP request function so tests can mock network calls without CORS issues. In production it defaults to `page.request.get()` (server-side, CORS-free).
- **Fuzzy keyword matching** — CTA detection uses keyword sets (e.g., `["trade", "trade-in", "trade value"]`) rather than exact text, handling variation across Cable Dahmer sites.
- **Page navigation contract** — `general.runChecks(page, pageUrl)` calls `page.goto()` internally. All other check modules receive an already-navigated page and must not call `page.goto()`.
- **10-minute hard timeout** — the browser is force-closed after 10 minutes; partial results are shown for any uncompleted page types.

## SSE Event Shape

```json
{ "type": "progress", "page": "SRP", "message": "Locating SRP page..." }
{ "type": "finding", "page": "VDP", "check": "Calculate Your Payment modal", "pass": false, "reason": "element not found" }
{ "type": "finding", "page": "General", "check": "Page load under 3s", "pass": true, "reason": null }
{ "type": "done", "summary": { "passed": 24, "failed": 3 } }
{ "type": "error", "message": "..." }
```

## Design Spec

`docs/superpowers/specs/2026-06-19-health-checker-design.md`
