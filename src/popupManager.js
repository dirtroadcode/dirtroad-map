import maplibregl from 'maplibre-gl'

/**
 * Create a popup lifecycle manager bound to a map.
 * Owns popup creation, configuration, and animated close.
 *
 * @param {maplibregl.Map} map
 * @returns {{ open: (html: string, lngLat: { lng: number, lat: number }) => maplibregl.Popup, close: () => void }}
 */
export function createPopupManager(map) {
  let currentPopup = null

  function open(html, lngLat, opts = {}) {
    close()
    currentPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: opts.maxWidth ?? '300px',
      offset: 12,
    })
      .setHTML(html)
      .setLngLat(lngLat)
      .addTo(map)
    return currentPopup
  }

  function close() {
    if (!currentPopup) return
    const el = currentPopup.getElement()
    if (el) {
      el.classList.add('maplibregl-popup-close')
      const popup = currentPopup
      el.addEventListener('animationend', () => popup.remove(), { once: true })
    } else {
      currentPopup.remove()
    }
    currentPopup = null
  }

  return { open, close }
}
