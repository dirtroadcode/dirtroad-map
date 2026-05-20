## What to build

Create a `kiosk.js` module that implements the core kiosk animation loop. After candidates load and markers render on the map, the kiosk automatically starts gliding between markers — opening popups to show candidates, then moving to the next one. This is the backbone of the kiosk feature, demoable on its own.

The animation loops indefinitely through all markers in random order, reshuffling silently when exhausted. Any user interaction with the map (click, touch, scroll) permanently kills the animation.

Wire the module into `main.js` by passing marker references after data loads.

## Acceptance criteria

- [ ] New `src/kiosk.js` module exports a `startKiosk(markers)` function
- [ ] `main.js` imports and calls `startKiosk` after markers are added to the map
- [ ] Markers are visited in random order with no repeats until all are exhausted, then reshuffled silently
- [ ] Animation sequence: pan to marker → open popup → hold 5 seconds → close popup → 0.5s pause → pan to next marker
- [ ] Pan uses a flat 1 second duration (variable duration comes in next slice)
- [ ] Popup opens with the existing `popupContent` for the marker's candidate group
- [ ] Any `mousedown`, `touchstart`, or `wheel` event on the map container permanently stops the animation
- [ ] Once killed, the animation never resumes (requires page reload)
- [ ] No visual indicator that kiosk mode is active — the animation itself is the affordance
- [ ] No marker highlight in this slice (constant radius throughout)

## Blocked by

None — can start immediately.
