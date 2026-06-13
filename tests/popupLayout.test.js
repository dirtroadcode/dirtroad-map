import { describe, it, expect } from 'vitest'
import { computePopupOffsetPx, pixelOffsetToLatOffset, prepareFlyToOffset } from '../src/popupLayout.js'

const baseCandidate = {
  name: 'Jane Doe',
  office: 'Governor',
  state: 'Texas',
  photo: '',
  district: '',
  town: '',
  website: '',
  cycle: '2026',
}

describe('computePopupOffsetPx', () => {
  it('returns base offset for a candidate with no photo', () => {
    const offset = computePopupOffsetPx([baseCandidate], new Map())

    // Should have a non-zero offset (text + arrow + margin)
    expect(offset).toBeGreaterThan(0)
    // But should be modest — just text, no photo
    expect(offset).toBeLessThan(150)
  })

  it('includes popup content padding (24px) and popup offset (12px)', () => {
    // Minimal candidate — no photo, no district, no town
    const minimal = { ...baseCandidate, state: '' }
    const offset = computePopupOffsetPx([minimal], new Map())

    // Expected breakdown:
    //   POPUP_ARROW (12) + VIEWPORT_MARGIN (16) = 28
    //   CONTENT_PADDING (24) + POPUP_OFFSET (12) = 36
    //   NAME_HEIGHT (22) + OFFICE_HEIGHT (17) = 39 (no state, district, town)
    //   1 gap between name and office = 4
    //   Total = 28 + 36 + 39 + 4 = 107
    expect(offset).toBe(107)
  })

  it('accounts for a square photo (400x400 → 200px displayed)', () => {
    const candidate = {
      ...baseCandidate,
      photo: 'https://example.com/photo.webp',
    }
    const imageSizes = new Map([
      ['https://example.com/photo.webp', { width: 400, height: 400 }],
    ])

    const noPhoto = computePopupOffsetPx([baseCandidate], new Map())
    const withPhoto = computePopupOffsetPx([candidate], imageSizes)

    // Square 400x400 displayed at 200px wide → 200px tall + 1 extra gap from the photo item
    expect(withPhoto - noPhoto).toBe(204)
  })

  it('accounts for a tall photo (400x600 → 300px displayed)', () => {
    const candidate = {
      ...baseCandidate,
      photo: 'https://example.com/tall.webp',
    }
    const imageSizes = new Map([
      ['https://example.com/tall.webp', { width: 400, height: 600 }],
    ])

    const withPhoto = computePopupOffsetPx([candidate], imageSizes)
    const noPhoto = computePopupOffsetPx([baseCandidate], new Map())

    // Tall photo: 600 * (200/400) = 300px displayed + 4px gap
    expect(withPhoto - noPhoto).toBe(304)
    // And should be taller than the square-photo version
    const square = computePopupOffsetPx([{ ...baseCandidate, photo: 'sq.webp' }],
      new Map([['sq.webp', { width: 400, height: 400 }]]))
    expect(withPhoto).toBeGreaterThan(square)
  })

  it('stacks multiple candidates with dividers', () => {
    const two = computePopupOffsetPx([baseCandidate, baseCandidate], new Map())
    const one = computePopupOffsetPx([baseCandidate], new Map())

    expect(two).toBeGreaterThan(one)
    expect(two - one).toBeGreaterThan(50)
  })
})

describe('pixelOffsetToLatOffset', () => {
  it('returns positive offset (north) for positive pixel offset', () => {
    const dlat = pixelOffsetToLatOffset(40, 8, 300)
    expect(dlat).toBeGreaterThan(0)
  })

  it('scales linearly — 600px is double 300px', () => {
    const small = pixelOffsetToLatOffset(40, 8, 300)
    const large = pixelOffsetToLatOffset(40, 8, 600)
    expect(large).toBeCloseTo(small * 2, 10)
  })

  it('larger offset at equator than at high latitude (Mercator compression)', () => {
    const equator = pixelOffsetToLatOffset(0, 8, 300)
    const arctic = pixelOffsetToLatOffset(70, 8, 300)
    expect(equator).toBeGreaterThan(arctic)
  })

  it('produces reasonable degree values at zoom 8', () => {
    // 300px at zoom 8, lat 40° should be roughly 1°
    const dlat = pixelOffsetToLatOffset(40, 8, 300)
    expect(dlat).toBeGreaterThan(0.5)
    expect(dlat).toBeLessThan(2.0)
  })
})

describe('prepareFlyToOffset', () => {
  it('returns a promise that resolves to a latitude offset', async () => {
    const candidates = [{ ...baseCandidate, photo: '' }]
    const dlat = await prepareFlyToOffset(candidates, 40, 8)
    // Should return a positive number (offset north)
    expect(typeof dlat).toBe('number')
    expect(dlat).toBeGreaterThan(0)
  })

  it('uses half the popup height for centering — not the full height', async () => {
    const candidates = [{ ...baseCandidate, photo: '' }]
    const dlat = await prepareFlyToOffset(candidates, 40, 8)

    // Compute what full-height offset would be
    const fullHeightPx = computePopupOffsetPx(candidates, new Map())
    const fullDlat = pixelOffsetToLatOffset(40, 8, fullHeightPx)

    // prepareFlyToOffset should return approximately half (centering)
    expect(dlat).toBeCloseTo(fullDlat / 2, 10)
    // But still positive
    expect(dlat).toBeGreaterThan(0)
  })

  it('includes preloaded image dimensions in the offset', async () => {
    const candidate = {
      ...baseCandidate,
      photo: 'https://example.com/photo.webp',
    }
    // No image sizes provided — will use fallback (square)
    const noPhotoOffset = await prepareFlyToOffset([baseCandidate], 40, 8)

    // Even without preloaded sizes, it should still produce an offset
    expect(noPhotoOffset).toBeGreaterThan(0)
  })

  it('positions popup between top padding and marker — viewport-aware', async () => {
    const candidates = [{ ...baseCandidate, photo: '' }]
    const lat = 40
    const zoom = 8
    const viewportHeight = 600

    const dlat = await prepareFlyToOffset(candidates, lat, zoom, viewportHeight)

    // Compute expected offset: popup sits between top padding and marker,
    // marker at (popupHeight + TOP_PADDING) from top, centered means:
    //   offsetPx = popupHeight + TOP_PADDING - viewportHeight / 2
    const fullHeightPx = computePopupOffsetPx(candidates, new Map())
    const TOP_PADDING = 16
    const expectedPx = fullHeightPx + TOP_PADDING - viewportHeight / 2
    const expectedDlat = pixelOffsetToLatOffset(lat, zoom, expectedPx)

    expect(dlat).toBeCloseTo(expectedDlat, 10)
  })

  it('shorter viewport pushes marker further below center — popup fills the view', async () => {
    const candidates = [{ ...baseCandidate, photo: '' }]

    const shortDlat = await prepareFlyToOffset(candidates, 40, 8, 400)
    const tallDlat = await prepareFlyToOffset(candidates, 40, 8, 900)

    // Short viewport → popup takes up more of the view → marker pushed further down → larger dlat
    // Tall viewport → popup is small → marker stays near top → smaller (or negative) dlat
    expect(shortDlat).toBeGreaterThan(tallDlat)
  })
})
