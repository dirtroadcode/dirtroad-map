---
type: feature
title: Live Google Sheets data source
added: '2026-03-19'
---

Move from static JSON to pulling candidate data live from a Google Spreadsheet published to the web. Since the upstream pipeline data is inconsistent in structure, create a new dedicated sheet for the map view where data is manually cleaned and maintained by a human.

- [ ] Create a new Google Sheet dedicated to map candidate data, transfer current candidates over
- [ ] Implement fetching published Google Sheet data (CSV/JSON) at runtime
- [ ] Replace static JSON import with live sheet fetch
- [ ] Update SPEC.md to reflect the new data source
