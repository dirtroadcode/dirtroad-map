import { describe, it, expect } from 'vitest'
import usBoundary from '../data/us-boundary.json'

describe('us-boundary.json', () => {
  it('is a valid GeoJSON FeatureCollection', () => {
    expect(usBoundary.type).toBe('FeatureCollection')
    expect(usBoundary.features).toBeInstanceOf(Array)
    expect(usBoundary.features.length).toBeGreaterThan(0)
  })

  it('contains a USA feature with MultiPolygon geometry', () => {
    const feature = usBoundary.features[0]
    expect(feature.type).toBe('Feature')
    expect(feature.geometry.type).toBe('MultiPolygon')
    expect(feature.geometry.coordinates).toBeInstanceOf(Array)
    expect(feature.geometry.coordinates.length).toBeGreaterThan(0)
  })

  it('has valid coordinate arrays (lng, lat pairs)', () => {
    const { coordinates } = usBoundary.features[0].geometry
    for (const polygon of coordinates) {
      for (const ring of polygon) {
        for (const [lng, lat] of ring) {
          expect(typeof lng).toBe('number')
          expect(typeof lat).toBe('number')
          expect(lng).toBeGreaterThanOrEqual(-180)
          expect(lng).toBeLessThanOrEqual(180)
          expect(lat).toBeGreaterThanOrEqual(-90)
          expect(lat).toBeLessThanOrEqual(90)
        }
      }
    }
  })
})
