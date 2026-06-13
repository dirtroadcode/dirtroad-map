// Layout constants matching popup CSS (.popup-card, .popup-photo, etc.)
const PHOTO_DISPLAY_WIDTH = 200
const POPUP_ARROW = 12
const VIEWPORT_MARGIN = 16
const CONTENT_PADDING = 24  // .maplibregl-popup-content padding: 12px × 2
const POPUP_OFFSET = 12      // Popup constructor offset param

// Estimated rendered heights per text element (font-size × ~1.2 line-height + rounding)
const NAME_HEIGHT = 22
const OFFICE_HEIGHT = 17
const DETAIL_HEIGHT = 16  // state, district, town
const GAP = 4
const DIVIDER_HEIGHT = 17  // margin 8px*2 + 1px border

function cardHeight(candidate, imageSizes) {
  let items = 0
  let h = 0

  if (candidate.photo) {
    const dims = imageSizes.get(candidate.photo)
    if (dims && dims.width > 0) {
      h += Math.round(dims.height * (PHOTO_DISPLAY_WIDTH / dims.width))
    } else {
      h += PHOTO_DISPLAY_WIDTH // assume square fallback
    }
    items++
  }

  h += NAME_HEIGHT; items++
  if (candidate.state) { h += DETAIL_HEIGHT; items++ }
  h += OFFICE_HEIGHT; items++
  if (candidate.district) { h += DETAIL_HEIGHT; items++ }
  if (candidate.town) { h += DETAIL_HEIGHT; items++ }

  h += Math.max(0, items - 1) * GAP

  return h
}

/**
 * Compute how many pixels of vertical offset are needed so the popup
 * doesn't clip at the top of the viewport.
 *
 * @param {Array} candidates - Candidate data objects
 * @param {Map<string, {width: number, height: number}>} imageSizes - Natural dimensions per photo URL
 * @returns {number} Pixel offset to push the center north
 */
export function computePopupOffsetPx(candidates, imageSizes) {
  let totalHeight = POPUP_ARROW + VIEWPORT_MARGIN + CONTENT_PADDING + POPUP_OFFSET

  for (let i = 0; i < candidates.length; i++) {
    if (i > 0) totalHeight += DIVIDER_HEIGHT
    totalHeight += cardHeight(candidates[i], imageSizes)
  }

  return totalHeight
}

/**
 * Convert a pixel offset into a latitude offset at a given zoom level.
 * Uses the Mercator projection formula:
 *   dlat = offsetPx * 360 * cos(lat) / worldSize
 * where worldSize = 256 * 2^zoom.
 *
 * @param {number} lat - Latitude in degrees
 * @param {number} zoom - Target zoom level
 * @param {number} offsetPx - Vertical pixels to shift center north
 * @returns {number} Latitude offset in degrees
 */
export function pixelOffsetToLatOffset(lat, zoom, offsetPx) {
  const worldSize = 256 * Math.pow(2, zoom)
  const latRad = lat * Math.PI / 180
  return offsetPx * 360 * Math.cos(latRad) / worldSize
}

/**
 * Pre-load images for candidate photos and return their natural dimensions.
 * Fails gracefully — returns an empty entry for broken URLs so the
 * layout function falls back to a square assumption.
 *
 * @param {Array} candidates
 * @param {number} [timeoutMs=3000]
 * @returns {Promise<Map<string, {width: number, height: number}>>}
 */
export function preloadImageSizes(candidates, timeoutMs = 3000) {
  const urls = [...new Set(candidates.map(c => c.photo).filter(Boolean))]
  if (!urls.length) return Promise.resolve(new Map())

  const entries = urls.map(url => {
    return new Promise(resolve => {
      const img = new Image()
      const timer = setTimeout(() => {
        img.src = ''
        resolve([url, { width: 0, height: 0 }])
      }, timeoutMs)
      img.onload = () => {
        clearTimeout(timer)
        resolve([url, { width: img.naturalWidth, height: img.naturalHeight }])
      }
      img.onerror = () => {
        clearTimeout(timer)
        resolve([url, { width: 0, height: 0 }])
      }
      img.src = url
    })
  })

  return Promise.all(entries).then(pairs => new Map(pairs))
}

/**
 * Deep module: preloads images, computes popup height, and converts to
 * latitude offset for centering. Returns half the popup height so the
 * popup center aligns with the viewport center.
 *
 * @param {Array} candidates
 * @param {number} lat - Latitude in degrees
 * @param {number} zoom - Target zoom level
 * @returns {Promise<number>} Latitude offset in degrees
 */
export async function prepareFlyToOffset(candidates, lat, zoom) {
  const sizes = await preloadImageSizes(candidates)
  const fullHeightPx = computePopupOffsetPx(candidates, sizes)
  return pixelOffsetToLatOffset(lat, zoom, fullHeightPx / 2)
}
