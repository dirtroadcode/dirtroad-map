import { initMap, addUsBoundary } from './map.js'
import { addOpenFreeMapLayers } from './openfreemap.js'
import { addMarkerLayers } from './markers.js'
import { attachPopupHandlers } from './popupRenderer.js'
import { createLegend } from './legend.js'
import './style.css'

const container = document.getElementById('map')
const map = initMap({ container })

map.on('load', () => {
  addUsBoundary(map)
  addOpenFreeMapLayers(map)
  addMarkerLayers(map).then(() => attachPopupHandlers(map))
})

container.appendChild(createLegend())
