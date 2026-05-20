## What to build

Layer on all the refined behaviors that make the kiosk animation feel polished and intentional. This builds on the core loop from slice 1 and adds: active marker highlighting, variable pan speed, popup offset, and the initial hold before the first glide.

## Acceptance criteria

- [ ] Active marker radius grows from 8 → 12 when featured, resets to 8 on popup close
- [ ] Pan duration varies by distance between markers: 0.5s minimum (nearby markers) to 2.0s maximum (cross-country), using something like `0.5 + (distance / maxDistance) * 1.5`
- [ ] Pan accounts for popup offset — same 10% vertical offset as the existing click handler (`marker.getLatLng()` → offset up by `map.getSize().y / 10`)
- [ ] On initial load, after data fetch and marker render, hold the full-US view for 2 seconds before the first glide begins
- [ ] Transition sequence is exactly: close popup → shrink marker → 0.5s pause → pan to next → grow new marker → open popup

## Blocked by

- `1-core-kiosk-loop.md` — requires the core kiosk loop to be in place
