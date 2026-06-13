// Layout constants matching popup CSS (.popup-card, .popup-photo, etc.)
const PHOTO_DISPLAY_WIDTH = 200
const POPUP_ARROW = 12
const VIEWPORT_MARGIN = 16
const CONTENT_PADDING = 24  // .maplibregl-popup-content padding: 12px × 2
const POPUP_OFFSET = 12      // Popup constructor offset param

import { renderPopupContent } from './popupRenderer.js'

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

const TOP_PADDING = 16  // space above popup in viewport
const VIEWPORT_FILL = 0.9
const MIN_PHOTO_HEIGHT = 100

/**
 * Compute non-photo chrome height for a set of candidates.
 * Includes arrows, margins, padding, text elements, gaps, and dividers.
 *
 * @param {Array} candidates
 * @returns {number} Chrome height in pixels
 */
function computeChromeHeight(candidates) {
  let h = POPUP_ARROW + VIEWPORT_MARGIN + CONTENT_PADDING + POPUP_OFFSET

  for (let i = 0; i < candidates.length; i++) {
    if (i > 0) h += DIVIDER_HEIGHT
    const c = candidates[i]
    let items = 0
    // Name always present
    h += NAME_HEIGHT; items++
    if (c.state) { h += DETAIL_HEIGHT; items++ }
    h += OFFICE_HEIGHT; items++
    if (c.district) { h += DETAIL_HEIGHT; items++ }
    if (c.town) { h += DETAIL_HEIGHT; items++ }
    h += Math.max(0, items - 1) * GAP
    // Add gap for photo if present (photo adds 1 more item)
    if (c.photo) h += GAP
  }

  return h
}

/**
 * Compute the target photo dimensions so the popup fills ~90% of the viewport.
 * The photo is the flex element — all remaining space after chrome is photo space.
 * Width is derived from the first candidate's photo aspect ratio.
 *
 * @param {number} viewportHeight - Viewport height in pixels
 * @param {Array} candidates - Candidate data objects
 * @param {Map<string, {width: number, height: number}>} imageSizes - Natural dimensions per photo URL
 * @returns {{ photoWidth: number, photoHeight: number }} Target photo dimensions (0,0 if no photo)
 */
export function computeTargetPhotoSize(viewportHeight, candidates, imageSizes) {
  const photoCandidate = candidates.find(c => c.photo)
  if (!photoCandidate) return { photoWidth: 0, photoHeight: 0 }

  const chrome = computeChromeHeight(candidates)
  const available = Math.max(MIN_PHOTO_HEIGHT, Math.round(VIEWPORT_FILL * viewportHeight - chrome))

  const dims = imageSizes.get(photoCandidate.photo)
  const aspectRatio = (dims && dims.width > 0) ? dims.width / dims.height : 1

  return {
    photoHeight: available,
    photoWidth: Math.round(available * aspectRatio),
  }
}

/**
 * Deep module: preloads images, computes popup height, and converts to
 * latitude offset for viewport-aware centering.
 *
 * Positions the marker so the popup fills the space between top padding
 * and the marker dot, with the marker at viewport vertical center.
 *
 * offsetPx = popupHeight + TOP_PADDING - viewportHeight / 2
 *
 * @param {Array} candidates
 * @param {number} lat - Latitude in degrees
 * @param {number} zoom - Target zoom level
 * @param {number} [viewportHeight] - Viewport height in pixels
 * @returns {Promise<number>} Latitude offset in degrees
 */
export async function prepareFlyToOffset(candidates, lat, zoom, viewportHeight) {
  const sizes = await preloadImageSizes(candidates)
  const fullHeightPx = computePopupOffsetPx(candidates, sizes)

  const offsetPx = viewportHeight != null
    ? Math.max(0, fullHeightPx + TOP_PADDING - viewportHeight / 2)
    : fullHeightPx / 2  // fallback: simple centering without viewport

  return pixelOffsetToLatOffset(lat, zoom, offsetPx)
}

/**
 * Deep module: preloads images, computes photo sizing to fill ~90% of the
 * viewport, and calculates the latitude offset so the popup top is at ~5%
 * of the viewport height (with the dot at ~95%).
 *
 * Returns everything the caller needs in a single object — no need to
 * separately compute photo sizes or manage image preloading.
 *
 * @param {Array} candidates
 * @param {number} lat - Latitude in degrees
 * @param {number} zoom - Target zoom level
 * @param {number} [viewportHeight] - Viewport height in pixels
 * @returns {Promise<{ dlat: number, photoWidth: number, photoHeight: number }>}
 */
export async function prepareLayout(candidates, lat, zoom, viewportHeight) {
  const imageSizes = await preloadImageSizes(candidates)
  const photoSize = viewportHeight != null
    ? computeTargetPhotoSize(viewportHeight, candidates, imageSizes)
    : { photoWidth: 0, photoHeight: 0 }

  // Compute total popup height with the scaled photo
  const chrome = computeChromeHeight(candidates)
  const totalHeight = chrome + photoSize.photoHeight

  // Center the camera so popup top is at 5% of viewport, dot at 95%
  // offsetPx = totalHeight - 0.45 * viewportHeight
  const offsetPx = viewportHeight != null
    ? Math.max(0, totalHeight - 0.45 * viewportHeight)
    : totalHeight / 2

  // Render HTML with the computed photo sizing baked in
  const html = renderPopupContent(candidates, photoSize)

  // Compute maxWidth to accommodate the photo (or default)
  const maxWidth = photoSize.photoWidth > 0
    ? photoSize.photoWidth + CONTENT_PADDING
    : '300px'

  return {
    dlat: pixelOffsetToLatOffset(lat, zoom, offsetPx),
    html,
    maxWidth,
    photoWidth: photoSize.photoWidth,
    photoHeight: photoSize.photoHeight,
  }
}
