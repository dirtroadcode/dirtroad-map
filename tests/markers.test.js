import { describe, it, expect, vi } from 'vitest'
import { buildMarkerGeoJSON, addMarkerLayers, COLORS } from '../src/markers.js'

/** Minimal valid CSV row helpers */
const header = 'name,level,office,district,town,state,photo,website,cycle,lat,lng'

function row(o) {
  return [
    o.name ?? 'Test Candidate',
    o.level ?? 'state',
    o.office ?? 'State Representative',
    o.district ?? '',
    o.town ?? '',
    o.state ?? 'Tennessee',
    o.photo ?? '',
    o.website ?? '',
    o.cycle ?? '2026',
    o.lat ?? '35.0',
    o.lng ?? '-85.0',
  ].join(',')
}

function csv(...rows) {
  return [header, ...rows].join('\n')
}

describe('buildMarkerGeoJSON', () => {
  it('groups candidates sharing the same coordinates into one feature', () => {
    const input = csv(
      row({ name: 'Alice', lat: '35.0', lng: '-85.0' }),
      row({ name: 'Bob', lat: '35.0', lng: '-85.0' }),
      row({ name: 'Carol', lat: '40.0', lng: '-74.0' }),
    )

    const geojson = buildMarkerGeoJSON(input)

    expect(geojson.type).toBe('FeatureCollection')
    expect(geojson.features).toHaveLength(2)

    const grouped = geojson.features.find(
      f => f.properties.count === 2,
    )
    expect(grouped).toBeDefined()
    expect(grouped.properties.names).toEqual(['Alice', 'Bob'])
  })

  it('resolves level priority: state > county > local', () => {
    const input = csv(
      row({ name: 'Local', level: 'local', lat: '35.0', lng: '-85.0' }),
      row({ name: 'County', level: 'county', lat: '35.0', lng: '-85.0' }),
      row({ name: 'State', level: 'state', lat: '35.0', lng: '-85.0' }),
    )

    const geojson = buildMarkerGeoJSON(input)
    expect(geojson.features).toHaveLength(1)
    expect(geojson.features[0].properties.level).toBe('state')
  })

  it('skips candidates with missing lat or lng', () => {
    const input = csv(
      row({ name: 'Valid', lat: '35.0', lng: '-85.0' }),
      row({ name: 'NoLat', lat: '', lng: '-85.0' }),
      row({ name: 'NoLng', lat: '35.0', lng: '' }),
      row({ name: 'Neither', lat: '', lng: '' }),
    )

    const geojson = buildMarkerGeoJSON(input)
    expect(geojson.features).toHaveLength(1)
    expect(geojson.features[0].properties.names).toEqual(['Valid'])
  })

  it('stores full candidate data in each feature\'s candidates property', () => {
    const input = csv(
      row({ name: 'Alice', office: 'State Senate', district: 'District 5', state: 'Tennessee', photo: 'https://example.com/alice.webp', website: 'https://alice.com', lat: '35.0', lng: '-85.0' }),
      row({ name: 'Bob', office: 'County Commissioner', district: '', state: 'Georgia', photo: '', website: '', lat: '35.0', lng: '-85.0' }),
    )

    const geojson = buildMarkerGeoJSON(input)
    expect(geojson.features).toHaveLength(1)
    const candidates = geojson.features[0].properties.candidates
    expect(candidates).toHaveLength(2)
    expect(candidates[0]).toEqual({
      name: 'Alice', office: 'State Senate', district: 'District 5',
      town: '', state: 'Tennessee', photo: 'https://example.com/alice.webp',
      website: 'https://alice.com', cycle: '2026',
    })
    expect(candidates[1]).toEqual({
      name: 'Bob', office: 'County Commissioner', district: '',
      town: '', state: 'Georgia', photo: '', website: '', cycle: '2026',
    })
  })

  it('assigns correct color per level', () => {
    const input = csv(
      row({ name: 'S', level: 'state', lat: '35.0', lng: '-85.0' }),
      row({ name: 'C', level: 'county', lat: '40.0', lng: '-74.0' }),
      row({ name: 'L', level: 'local', lat: '34.0', lng: '-118.0' }),
    )

    const geojson = buildMarkerGeoJSON(input)

    const byLevel = Object.fromEntries(
      geojson.features.map(f => [f.properties.level, f.properties.color]),
    )
    expect(byLevel.state).toBe(COLORS.state)
    expect(byLevel.county).toBe(COLORS.county)
    expect(byLevel.local).toBe(COLORS.local)
  })
})

describe('addMarkerLayers', () => {
  function createMockMap() {
    const map = {
      _sources: {},
      _layers: [],
      addSource(id, source) { map._sources[id] = source },
      addLayer(layer) { map._layers.push(layer) },
    }
    return map
  }

  it('adds a candidates GeoJSON source', async () => {
    const map = createMockMap()
    const csv = header + '\n' + row({ name: 'Alice', level: 'state', lat: '35.0', lng: '-85.0' })

    // Mock global fetch
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => csv })

    await addMarkerLayers(map)

    globalThis.fetch = originalFetch

    expect(map._sources['candidates']).toBeDefined()
    expect(map._sources['candidates'].type).toBe('geojson')
    expect(map._sources['candidates'].data.type).toBe('FeatureCollection')
  })

  it('adds glow + dot layers per level with correct colors', async () => {
    const map = createMockMap()
    const csv = header + '\n' + row({ name: 'A', level: 'state', lat: '35', lng: '-85' })
      + '\n' + row({ name: 'B', level: 'county', lat: '40', lng: '-74' })
      + '\n' + row({ name: 'C', level: 'local', lat: '34', lng: '-118' })

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => csv })

    await addMarkerLayers(map)

    globalThis.fetch = originalFetch

    for (const level of ['state', 'county', 'local']) {
      const glow = map._layers.find(l => l.id === `candidates-${level}-glow`)
      const dot = map._layers.find(l => l.id === `candidates-${level}-dot`)
      expect(glow).toBeDefined()
      expect(dot).toBeDefined()
      expect(glow.paint['circle-color']).toBe(COLORS[level])
      expect(dot.paint['circle-color']).toBe(COLORS[level])
      expect(glow.paint['circle-blur']).toBe(1)
      expect(glow.paint['circle-opacity']).toBeLessThan(1)
    }
  })
})
