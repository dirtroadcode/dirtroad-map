import { describe, it, expect } from 'vitest'
import { LEVELS, COLORS, LEVEL_PRIORITY, CANDIDATE_LAYERS } from '../src/levels.js'

describe('levels module', () => {
  it('exports the canonical level list, colors, priority map, and derived layer IDs', () => {
    expect(LEVELS).toEqual(['state', 'county', 'local'])

    expect(COLORS).toEqual({
      state:  '#F5C518',
      county: '#B87333',
      local:  '#7A9E7E',
    })

    expect(LEVEL_PRIORITY).toEqual({ state: 3, county: 2, local: 1 })

    expect(CANDIDATE_LAYERS).toEqual([
      'candidates-state-glow', 'candidates-state-dot',
      'candidates-county-glow', 'candidates-county-dot',
      'candidates-local-glow', 'candidates-local-dot',
    ])
  })

  it('derives CANDIDATE_LAYERS from LEVELS — not a hardcoded array', () => {
    // Prove the structure: for each level, glow then dot
    for (let i = 0; i < LEVELS.length; i++) {
      expect(CANDIDATE_LAYERS[i * 2]).toBe(`candidates-${LEVELS[i]}-glow`)
      expect(CANDIDATE_LAYERS[i * 2 + 1]).toBe(`candidates-${LEVELS[i]}-dot`)
    }
  })
})
