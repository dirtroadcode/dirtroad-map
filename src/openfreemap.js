/**
 * Add OpenFreeMap vector tile layers (boundaries + place labels only).
 * @param {maplibregl.Map} map
 */
export function addOpenFreeMapLayers(map) {
  map.addSource('openfreemap', {
    type: 'vector',
    url: 'https://tiles.openfreemap.org/planet',
  })

  map.addLayer({
    id: 'admin-boundary',
    type: 'line',
    source: 'openfreemap',
    'source-layer': 'boundary',
    paint: {
      'line-color': '#ffffff',
      'line-opacity': 0.3,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 8, 1.5],
    },
  })

  map.addLayer({
    id: 'place-label',
    type: 'symbol',
    source: 'openfreemap',
    'source-layer': 'place',
    layout: {
      'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
      'text-size': ['interpolate', ['linear'], ['zoom'], 3, 8, 8, 13],
    },
    paint: {
      'text-color': '#ffffff',
      'text-opacity': 0.4,
    },
  })
}
