// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { createLegend } from '../src/legend.js'
import { COLORS } from '../src/markers.js'

describe('createLegend', () => {
  it('returns a container with three legend items labeled State, County, Local', () => {
    const el = createLegend()

    expect(el.classList.contains('legend')).toBe(true)

    const items = el.querySelectorAll('.legend-item')
    expect(items).toHaveLength(3)

    const labels = [...items].map(item => item.textContent.trim())
    expect(labels).toEqual(['State', 'County', 'Local'])
  })

  it('uses correct category colors for swatches', () => {
    const el = createLegend()
    const swatches = el.querySelectorAll('.legend-swatch')
    expect(swatches).toHaveLength(3)

    // jsdom normalizes hex to rgb, so check via a temp element
    const levels = ['state', 'county', 'local']
    for (let i = 0; i < levels.length; i++) {
      const expected = document.createElement('span')
      expected.style.backgroundColor = COLORS[levels[i]]
      expect(swatches[i].style.backgroundColor).toBe(expected.style.backgroundColor)
    }
  })
})
