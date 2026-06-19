# Website Health Checker — Design Spec
**Date:** 2026-06-19  
**Status:** Approved

---

## Overview

An on-demand web audit tool for Cable Dahmer dealership websites. A user selects a site from a dropdown, clicks "Run Audit," and receives a live pass/fail report covering all critical page types and functionality checks. Built with Node.js + Express on the backend and a simple HTML/JS frontend, using Playwright for browser automation.

---

## Goals

- Run a full health audit of any Cable Dahmer website on demand
- Surface broken links, images, buttons, forms, and page-type-specific functionality
- Stream live progress to the UI so users can watch the audit in real time
- Produce a clean pass/fail summary grouped by check type
- Handle variation across Cable Dahmer sites (different button text, layouts, CTA labels)

## Non-Goals

- Scheduled / automated monitoring (manual trigger only)
- Spelling or content accuracy checks (requires human review)
- OEM rotator visibility checks (requires human review)
- Exporting reports to PDF or CSV (future enhancement)
- Checking external/third-party sites discovered via links

---

## Architecture

```
website-health-checker/
├── server.js                   # Express server — serves static files, mounts API routes
├── routes/
│   ├── sites.js                # GET /api/sites — returns fixed Cable Dahmer site list
│   ├── audit.js                # POST /api/audit — starts audit, returns auditId
│   └── stream.js               # GET /api/audit/:id/stream — SSE progress feed
├── crawler/
│   ├── index.js                # Orchestrates page navigation and check dispatch
│   └── checks/
│       ├── general.js          # Load time, broken images, broken nav links
│       ├── homepage.js         # Dropdowns, CTAs, rotators, chat widget
│       ├── srp.js              # Pricing, sorting, filters, locations, CTAs
│       ├── vdp.js              # CTA modals, vehicle details, images
│       ├── specials.js         # Specials listings, CTA navigation
│       ├── service.js          # Appointment scheduler loads and is interactive
│       └── finance.js          # Prequalification and finance forms load
├── public/
│   ├── index.html              # UI — site dropdown, run button, live results panel
│   ├── app.js                  # SSE listener, DOM updates, summary rendering
│   └── styles.css
├── package.json
└── CLAUDE.md
```

---

## Data Flow

1. User selects a Cable Dahmer site from the dropdown and clicks **Run Audit**
2. Frontend sends `POST /api/audit { url }` → server creates an audit record, returns `{ auditId }`
3. Frontend opens `GET /api/audit/:id/stream` (SSE connection)
4. Server launches a headless Playwright browser
5. Crawler navigates to each page type in sequence, runs its check suite
6. Each finding is streamed as an SSE event → frontend updates the live results panel
7. When all page types are checked, server emits a `done` event
8. Frontend closes the SSE connection and renders the final pass/fail summary

### SSE Event Shape

```json
{ "type": "progress", "page": "SRP", "message": "Checking sort functionality..." }
{ "type": "finding", "page": "VDP", "check": "Calculate Your Payment modal", "pass": false, "reason": "element not found" }
{ "type": "finding", "page": "General", "check": "Page load under 3s", "pass": true }
{ "type": "done", "summary": { "passed": 24, "failed": 3 } }
```

---

## Checks by Page Type

Each check reports independently as **Pass** or **Fail**.

### General (run on every page type)
| Check | Pass Condition | Fail Condition |
|---|---|---|
| Page loads under 3 seconds | Load time < 3000ms | Load time ≥ 3000ms or timeout |
| No broken images | All `<img>` return HTTP 2xx | Any image returns 4xx/5xx or has empty src |
| No broken navigation links | All nav `<a href>` return HTTP 2xx or 3xx | Any nav link returns 4xx/5xx |

### Homepage
| Check | Pass Condition | Fail Condition |
|---|---|---|
| Shop by Vehicle dropdowns open | Dropdown options populate on click | No options appear within 3s |
| CTAs navigate correctly | Clicking a CTA changes the URL | Page doesn't change or errors |
| Rotators are clickable and navigate | Clicking rotator changes the URL | No navigation occurs |
| Chat widget visible and opens | Widget visible; click opens chat interface | Widget missing or doesn't open |

### SRP (Search Results Page)
| Check | Pass Condition | Fail Condition |
|---|---|---|
| Listings display pricing | Price element present with a value | No price found on any listing |
| Sort "Price: Low to High" works | First price after sort ≤ last price | Order unchanged or error |
| Filters update results | Result count changes after filter click | Results unchanged |
| Dealership locations listed | Location selector shows multiple entries | No locations found |
| Expected CTAs are present | CTA buttons visible on listings | No CTAs found |

### VDP (Vehicle Detail Page)
| Check | Pass Condition | Fail Condition |
|---|---|---|
| "Value Your Trade" modal opens | Modal/overlay becomes visible within 3s | Nothing opens |
| "Calculate Your Payment" modal opens | Modal/overlay becomes visible within 3s | Nothing opens |
| "Get Prequalified" modal opens | Modal/overlay becomes visible within 3s | Nothing opens |
| "Schedule a Test Drive" modal opens | Modal/overlay becomes visible within 3s | Nothing opens |
| Vehicle price is present | Price element has a non-empty value | Price missing or blank |
| VIN is present | VIN element has a valid value | VIN missing or blank |
| Stock number is present | Stock number element has a value | Stock number missing |
| All images load | All vehicle images return HTTP 2xx | Any image returns 4xx/5xx |

### Specials
| Check | Pass Condition | Fail Condition |
|---|---|---|
| New Specials listings display | At least one listing visible | No listings found |
| Pre-Owned Specials listings display | At least one listing visible | No listings found |
| Specials CTAs navigate to VDP or offer page | Click leads to a VDP or offer URL | Navigation fails or 4xx |

### Service
| Check | Pass Condition | Fail Condition |
|---|---|---|
| Appointment scheduler loads | Scheduler widget/iframe is visible | Widget missing or blank |
| Scheduler is interactive | Can interact with first step (date/time picker or form) | No interaction possible |

### Finance
| Check | Pass Condition | Fail Condition |
|---|---|---|
| Prequalification form displays | Form fields are visible | Form missing or blank |
| Finance Application form displays | Form fields are visible | Form missing or blank |

### Manual Checks (not automated — flag in report)
- OEM rotators are hidden
- Spelling, content accuracy, and current promotions

---

## Cross-Site Variation Handling

Cable Dahmer sites vary in button text, CTA labels, and page structure. The checker uses:

- **Fuzzy keyword matching** on button/link text — e.g., "trade" matches "Value Your Trade," "Trade-In Estimator," "Get Trade Value"
- **URL pattern matching** to identify page types — e.g., `/inventory`, `/srp`, `/vdp`, `/specials`, `/service`, `/finance`
- **Multiple fallback selectors** per check — tries several CSS selectors and ARIA roles before marking as failed
- **Keyword sets per CTA** — e.g., schedule-test-drive keywords: `["test drive", "schedule", "appointment", "drive"]`

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Page won't load | All checks for that page type → ❌ Fail: "page unreachable" |
| Element not found | That check → ❌ Fail: "element not found" — no crash |
| Modal doesn't open within 3s | That check → ❌ Fail: "no response to click" |
| Redirect loop (3+ redirects) | ❌ Fail: "redirect loop detected" — move on |
| JS error on page | Captured and surfaced as a warning in the report |
| Audit exceeds 10 minutes | Timeout — partial results shown, unchecked items marked "not reached" |

Button interaction rule: **never click submit buttons inside forms.** Click to open modals/forms, verify they appear, then close via Escape or the × button.

---

## UI

- **Site dropdown** — fixed list of Cable Dahmer websites
- **Run Audit button** — triggers the audit
- **Live progress panel** — streams findings in real time as each check completes
- **Summary section** — appears when audit finishes; grouped by page type with pass/fail per check
- **Spinner + status line** — shows which page type is currently being checked

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js |
| Server | Express |
| Browser automation | Playwright (headless Chromium) |
| Frontend | Vanilla HTML / CSS / JS |
| Live updates | Server-Sent Events (SSE) |
| HTTP checks | Playwright network interception + `fetch` |

---

## Out of Scope (Future Enhancements)

- Scheduled/automated runs
- PDF/CSV export
- Multi-user access or authentication
- Mobile viewport testing
- Historical audit comparison
