---
type: feature
title: Add colored candidate markers by office type
finished: '2026-03-18'
---

Load candidates from the JSON file. For each candidate, render a Leaflet circleMarker at their lat/lng coordinates. Simplify office types into 3 categories (state, county, local) and color-code markers accordingly: state = amber (#E67E22), county = teal (#16A085), local = purple (#8E44AD). Avoid blue and red for political neutrality. Define the category mapping and color config in a constants object. Add a simple legend overlay showing the 3 categories.
