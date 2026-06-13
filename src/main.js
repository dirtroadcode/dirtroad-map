import { initMap, addUsBoundary } from './map.js'
import { addOpenFreeMapLayers } from './openfreemap.js'
import { addMarkerLayers, fetchCandidateCSV } from './markers.js'
import { attachPopupHandlers } from './popupRenderer.js'
import { createLegend } from './legend.js'
import { startKiosk } from './kiosk.js'
import './style.css'

const container = document.getElementById('map')
const map = initMap({ container })

// Start CSV fetch immediately — don't wait for map load
const csvPromise = fetchCandidateCSV()

map.on('load', () => {
  addUsBoundary(map)
  addOpenFreeMapLayers(map)
  addMarkerLayers(map, csvPromise).then((geojson) => {
    attachPopupHandlers(map)
    startKiosk(map, geojson)
  })
})

container.appendChild(createLegend())
