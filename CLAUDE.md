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
