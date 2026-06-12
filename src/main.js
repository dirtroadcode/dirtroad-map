import { initMap, addUsBoundary } from './map.js'
import { addOpenFreeMapLayers } from './openfreemap.js'
import { addMarkerLayers } from './markers.js'
import './style.css'

const map = initMap({ container: document.getElementById('map') })

map.on('load', () => {
  addUsBoundary(map)
  addOpenFreeMapLayers(map)
  addMarkerLayers(map)
})
