import { LEVELS, COLORS } from './levels.js'

const LABELS = [
  { level: 'state', label: 'State' },
  { level: 'county', label: 'County' },
  { level: 'local', label: 'Local' },
]

export function createLegend() {
  const container = document.createElement('div')
  container.className = 'legend'

  for (const { level, label } of LABELS) {
    const item = document.createElement('div')
    item.className = 'legend-item'
    item.dataset.level = level

    const swatch = document.createElement('span')
    swatch.className = 'legend-swatch'
    swatch.style.backgroundColor = COLORS[level]

    const text = document.createElement('span')
    text.textContent = label

    item.appendChild(swatch)
    item.appendChild(text)
    container.appendChild(item)
  }

  return container
}
