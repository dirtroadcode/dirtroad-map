import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import usBoundary from '../data/us-boundary.json'

const US_CENTER = [-98.5, 39.8]
const DEFAULT_ZOOM = 3.5

/**
 * Create the transparent MapLibre style with just a background layer.
 */
export function createStyle() {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-opacity': 0,
        },
      },
    ],
  }
}

/**
 * Add US boundary GeoJSON as a navy filled polygon.
 * @param {maplibregl.Map} map
 */
export function addUsBoundary(map) {
  map.addSource('us-boundary', {
    type: 'geojson',
    data: usBoundary,
  })

  map.addLayer({
    id: 'us-boundary-fill',
    type: 'fill',
    source: 'us-boundary',
    paint: {
      'fill-color': '#001725',
      'fill-opacity': 1,
    },
  })
}

/**
 * Initialize a MapLibre GL map with transparent background.
 * @param {{ container: HTMLElement }} opts
 * @returns {maplibregl.Map}
 */
export function initMap({ container }) {
  const isMobile = window.innerWidth < 768

  const map = new maplibregl.Map({
    container,
    style: createStyle(),
    center: US_CENTER,
    zoom: DEFAULT_ZOOM,
    attributionControl: false,
    minZoom: 3,
  })

  const usBounds = [
    [-125, 24],  // SW corner
    [-66, 50],   // NE corner
  ]

  const fitUS = () => map.fitBounds(usBounds, { padding: 20 })

  map.on('load', fitUS)
  window.addEventListener('resize', fitUS)

  map.scrollZoom.disable()

  map.on('click', () => {
    map.scrollZoom.enable()
    window.removeEventListener('resize', fitUS)
    container.classList.add('map-interactive')
  })

  return map
}
