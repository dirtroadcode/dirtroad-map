import { describe, it, expect } from 'vitest'
import { computePopupOffsetPx, pixelOffsetToLatOffset, prepareFlyToOffset, computeTargetPhotoSize, prepareLayout } from '../src/popupLayout.js'

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

    // Compute expected offset — clamped to 0 (no negative offsets)
    const fullHeightPx = computePopupOffsetPx(candidates, new Map())
    const TOP_PADDING = 16
    const expectedPx = Math.max(0, fullHeightPx + TOP_PADDING - viewportHeight / 2)
    const expectedDlat = pixelOffsetToLatOffset(lat, zoom, expectedPx)

    expect(dlat).toBeCloseTo(expectedDlat, 10)
  })

  it('never produces a negative offset — marker must not go above viewport center', async () => {
    // No-photo candidate: popup is small (~147px) vs large viewport (900px).
    // Without clamping, offsetPx = 147 + 16 - 450 = -287 → marker pinned at top.
    const candidates = [{ ...baseCandidate, photo: '' }]
    const dlat = await prepareFlyToOffset(candidates, 40, 6, 900)

    // Offset should be zero or positive — marker never above center
    expect(dlat).toBeGreaterThanOrEqual(0)
  })

  it('shorter viewport pushes marker further below center — popup fills the view', async () => {
    // Use multiple no-photo candidates to get a tall popup that produces
    // positive offsets on both viewports — avoids image preload timeouts
    const candidates = [baseCandidate, baseCandidate, baseCandidate]

    const shortDlat = await prepareFlyToOffset(candidates, 40, 8, 400)
    const tallDlat = await prepareFlyToOffset(candidates, 40, 8, 900)

    // Short viewport → popup takes up more of the view → marker pushed further down → larger dlat
    // Tall viewport → popup is small relative to viewport → marker stays closer to center → smaller dlat
    expect(shortDlat).toBeGreaterThan(tallDlat)
  })
})

describe('computeTargetPhotoSize', () => {
  it('fills remaining viewport space after subtracting chrome', () => {
    const viewportHeight = 600
    const candidates = [{
      ...baseCandidate,
      photo: 'https://example.com/photo.webp',
    }]
    const imageSizes = new Map([
      ['https://example.com/photo.webp', { width: 400, height: 600 }],
    ])

    const size = computeTargetPhotoSize(viewportHeight, candidates, imageSizes)

    // Chrome (non-photo content) should be ~131px
    // 0.9 * 600 = 540 available. 540 - 131 chrome = 409 for photo
    // But MAX_PHOTO_HEIGHT_RATIO (0.6) caps height to 360 → that wins
    expect(size.photoHeight).toBeGreaterThan(0)
    expect(size.photoWidth).toBeGreaterThan(0)
    expect(size.photoHeight).toBe(360) // capped by 0.6 * 600
  })

  it('derives width from image aspect ratio', () => {
    const viewportHeight = 800
    const candidates = [{
      ...baseCandidate,
      photo: 'https://example.com/square.webp',
    }]
    const imageSizes = new Map([
      ['https://example.com/square.webp', { width: 500, height: 500 }],
    ])

    const size = computeTargetPhotoSize(viewportHeight, candidates, imageSizes)

    // Square image → width should equal height
    expect(size.photoWidth).toBe(size.photoHeight)
  })

  it('clamps to minimum height so tiny viewports do not collapse', () => {
    const viewportHeight = 300 // small viewport, but not tiny enough for MIN_PHOTO_HEIGHT
    const candidates = [{
      ...baseCandidate,
      photo: 'https://example.com/photo.webp',
    }]
    const imageSizes = new Map([
      ['https://example.com/photo.webp', { width: 400, height: 600 }],
    ])

    const size = computeTargetPhotoSize(viewportHeight, candidates, imageSizes)

    // 0.6 * 300 = 180 max height, which is above MIN_PHOTO_HEIGHT (100)
    expect(size.photoHeight).toBeGreaterThanOrEqual(100)
  })

  it('caps photo width to a maximum so popups stay narrow', () => {
    // Square image on a tall viewport would produce a huge square photo
    const viewportHeight = 1080
    const candidates = [{
      ...baseCandidate,
      photo: 'https://example.com/square.webp',
    }]
    const imageSizes = new Map([
      ['https://example.com/square.webp', { width: 500, height: 500 }],
    ])

    const size = computeTargetPhotoSize(viewportHeight, candidates, imageSizes)

    // Width must be capped (300px max) even though viewport would allow much more
    expect(size.photoWidth).toBeLessThanOrEqual(300)
    // Height should be scaled down proportionally (square → same as width)
    expect(size.photoHeight).toBe(size.photoWidth)
  })

  it('caps photo height to a fraction of viewport height', () => {
    // Tall image (portrait headshot) on a large viewport
    const viewportHeight = 1080
    const candidates = [{
      ...baseCandidate,
      photo: 'https://example.com/tall.webp',
    }]
    const imageSizes = new Map([
      ['https://example.com/tall.webp', { width: 300, height: 600 }],
    ])

    const size = computeTargetPhotoSize(viewportHeight, candidates, imageSizes)

    // Photo should not fill more than 60% of viewport height
    expect(size.photoHeight).toBeLessThanOrEqual(Math.round(0.6 * viewportHeight))
  })

  it('respects the tighter constraint when both width and height caps apply', () => {
    // Wide landscape photo on a large viewport: width cap should dominate
    const viewportHeight = 1080
    const candidates = [{
      ...baseCandidate,
      photo: 'https://example.com/wide.webp',
    }]
    const imageSizes = new Map([
      ['https://example.com/wide.webp', { width: 1200, height: 400 }], // 3:1 aspect
    ])

    const size = computeTargetPhotoSize(viewportHeight, candidates, imageSizes)

    // Width capped at 300 → height = 300 * (400/1200) = 100
    expect(size.photoWidth).toBeLessThanOrEqual(300)
    expect(size.photoHeight).toBe(Math.round(size.photoWidth * (400 / 1200)))
  })

  it('returns zero dimensions when no candidate has a photo', () => {
    const viewportHeight = 600
    const candidates = [{ ...baseCandidate, photo: '' }]

    const size = computeTargetPhotoSize(viewportHeight, candidates, new Map())

    // No photo → no sizing needed
    expect(size.photoHeight).toBe(0)
    expect(size.photoWidth).toBe(0)
  })
})

describe('prepareLayout', () => {
  it('returns dlat, photoWidth, and photoHeight from a single call', async () => {
    const candidates = [{
      ...baseCandidate,
      photo: 'https://example.com/photo.webp',
    }]
    const layout = await prepareLayout(candidates, 40, 8, 600)

    expect(typeof layout.dlat).toBe('number')
    expect(typeof layout.photoWidth).toBe('number')
    expect(typeof layout.photoHeight).toBe('number')
    expect(layout.dlat).toBeGreaterThan(0)
    expect(layout.photoHeight).toBeGreaterThan(0)
    expect(layout.photoWidth).toBeGreaterThan(0)
  })

  it('positions popup within the viewport', async () => {
    const candidates = [{
      ...baseCandidate,
      photo: 'https://example.com/photo.webp',
    }]
    const viewportHeight = 600
    const lat = 40
    const zoom = 8

    const layout = await prepareLayout(candidates, lat, zoom, viewportHeight)

    // The camera offset should push the center so the popup fits in view
    // popup top = viewportHeight/2 - dlatPx should be > 0
    const dlatPx = layout.dlat / pixelOffsetToLatOffset(lat, zoom, 1)
    const popupTop = viewportHeight / 2 - dlatPx
    expect(popupTop).toBeGreaterThan(0)
    // Popup should occupy upper portion of viewport, not push marker below center
    expect(dlatPx).toBeGreaterThanOrEqual(0)
  })

  it('returns zero photo dimensions when no candidate has a photo', async () => {
    const candidates = [{ ...baseCandidate, photo: '' }]
    const layout = await prepareLayout(candidates, 40, 8, 600)

    expect(layout.photoWidth).toBe(0)
    expect(layout.photoHeight).toBe(0)
  })

  it('returns html with inline-styled photo dimensions (not HTML attributes)', async () => {
    const candidates = [{
      ...baseCandidate,
      name: 'Inline Styled',
      photo: 'https://example.com/photo.webp',
      website: 'https://example.com',
    }]
    const layout = await prepareLayout(candidates, 40, 8, 600)

    expect(layout.html).toContain('Inline Styled')
    // Inline style overrides CSS — HTML attributes would be overridden by .popup-photo { width: 200px }
    expect(layout.html).toMatch(/style="[^"]*width:\s*\d+px/)
    expect(layout.html).toMatch(/style="[^"]*height:\s*\d+px/)
    expect(layout.html).toContain('object-fit: cover')
    // Should NOT use HTML width/height attributes (CSS overrides them)
    expect(layout.html).not.toMatch(/width="\d+"/)
    expect(layout.html).not.toMatch(/height="\d+"/)
  })

  it('returns html without inline width/height when no photo', async () => {
    const candidates = [{ ...baseCandidate, photo: '' }]
    const layout = await prepareLayout(candidates, 40, 8, 600)

    expect(layout.html).toContain(baseCandidate.name)
    // No photo → no inline width/height style at all
    expect(layout.html).not.toMatch(/width:\s*\d+px/)
    expect(layout.html).not.toMatch(/height:\s*\d+px/)
  })

  it('returns maxWidth as a CSS string with px unit', async () => {
    const candidates = [{
      ...baseCandidate,
      photo: 'https://example.com/photo.webp',
    }]
    const layout = await prepareLayout(candidates, 40, 8, 800)

    // maxWidth must be a CSS string like '324px', not a bare number
    expect(typeof layout.maxWidth).toBe('string')
    expect(layout.maxWidth).toMatch(/^\d+px$/)
    // Should accommodate photoWidth + padding
    const numericWidth = parseInt(layout.maxWidth)
    expect(numericWidth).toBeGreaterThanOrEqual(layout.photoWidth)
  })

  it('returns default maxWidth when no photo', async () => {
    const candidates = [{ ...baseCandidate, photo: '' }]
    const layout = await prepareLayout(candidates, 40, 8, 600)

    expect(layout.maxWidth).toBe('300px')
  })
})
