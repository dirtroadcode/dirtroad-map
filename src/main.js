import { initMap, addUsBoundary } from './map.js'
import './style.css'

const map = initMap({ container: document.getElementById('map') })

map.on('load', () => {
  addUsBoundary(map)
})
