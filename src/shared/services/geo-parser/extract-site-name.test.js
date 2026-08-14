import {
  applyExtractedSiteNames,
  extractSiteNameFromProperties
} from './extract-site-name.js'

describe('extractSiteNameFromProperties', () => {
  describe('KML', () => {
    it('extracts the name property', () => {
      expect(
        extractSiteNameFromProperties({ name: 'North Harbour' }, 'kml')
      ).toBe('North Harbour')
    })

    it('extracts name case-insensitively', () => {
      expect(extractSiteNameFromProperties({ Name: 'East Pier' }, 'kml')).toBe(
        'East Pier'
      )
    })

    it('returns null when name is missing', () => {
      expect(
        extractSiteNameFromProperties({ description: 'A site' }, 'kml')
      ).toBe(null)
    })

    it('returns null when name is blank', () => {
      expect(extractSiteNameFromProperties({ name: '   ' }, 'kml')).toBe(null)
    })

    it('does not use shapefile column names', () => {
      expect(
        extractSiteNameFromProperties({ Site_name: 'Should not use' }, 'kml')
      ).toBe(null)
    })
  })

  describe('shapefile', () => {
    it.each([
      [{ Site_name: 'North Harbour' }, 'North Harbour'],
      [{ Sitename: 'East Pier' }, 'East Pier'],
      [{ Name: 'West Dock' }, 'West Dock'],
      [{ SITE_NAME: 'Uppercase column' }, 'Uppercase column'],
      [{ sitename: 'lowercase column' }, 'lowercase column']
    ])('extracts from %j', (properties, expected) => {
      expect(extractSiteNameFromProperties(properties, 'shapefile')).toBe(
        expected
      )
    })

    it('prefers Site_name over Sitename and Name', () => {
      expect(
        extractSiteNameFromProperties(
          {
            Name: 'Name column',
            Sitename: 'Sitename column',
            Site_name: 'Site_name column'
          },
          'shapefile'
        )
      ).toBe('Site_name column')
    })

    it('falls through to Name when Site_name is blank', () => {
      expect(
        extractSiteNameFromProperties(
          { Site_name: '  ', Name: 'Fallback name' },
          'shapefile'
        )
      ).toBe('Fallback name')
    })

    it('returns null when no recognised column has a value', () => {
      expect(
        extractSiteNameFromProperties({ other: 'ignored' }, 'shapefile')
      ).toBe(null)
    })
  })

  describe('normalisation', () => {
    it('trims whitespace', () => {
      expect(
        extractSiteNameFromProperties({ name: '  Harbour  ' }, 'kml')
      ).toBe('Harbour')
    })

    it('truncates names longer than 250 characters', () => {
      const longName = 'a'.repeat(251)
      expect(extractSiteNameFromProperties({ name: longName }, 'kml')).toBe(
        'a'.repeat(250)
      )
    })

    it('converts finite numbers to strings', () => {
      expect(extractSiteNameFromProperties({ name: 42 }, 'kml')).toBe('42')
    })

    it('returns null for non-string, non-number values', () => {
      expect(
        extractSiteNameFromProperties({ name: { nested: true } }, 'kml')
      ).toBe(null)
    })

    it('returns null when properties are missing', () => {
      expect(extractSiteNameFromProperties(null, 'kml')).toBe(null)
      expect(extractSiteNameFromProperties(undefined, 'shapefile')).toBe(null)
    })
  })
})

describe('applyExtractedSiteNames', () => {
  const polygonGeometry = {
    type: 'Polygon',
    coordinates: [
      [
        [-0.1, 51.5],
        [-0.2, 51.5],
        [-0.2, 51.6],
        [-0.1, 51.6],
        [-0.1, 51.5]
      ]
    ]
  }

  it('copies extracted KML names onto properties.name', () => {
    const geoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: polygonGeometry,
          properties: { name: 'Harbour' }
        },
        {
          type: 'Feature',
          geometry: polygonGeometry,
          properties: {}
        }
      ]
    }

    applyExtractedSiteNames(geoJSON, 'kml')

    expect(geoJSON.features[0].properties.name).toBe('Harbour')
    expect(geoJSON.features[1].properties.name).toBeUndefined()
  })

  it('copies shapefile Site_name onto properties.name', () => {
    const geoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: polygonGeometry,
          properties: { Site_name: 'North Harbour' }
        }
      ]
    }

    applyExtractedSiteNames(geoJSON, 'shapefile')

    expect(geoJSON.features[0].properties.name).toBe('North Harbour')
    expect(geoJSON.features[0].properties.Site_name).toBe('North Harbour')
  })

  it('leaves features without a site name unchanged', () => {
    const geoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: polygonGeometry,
          properties: { other: 'value' }
        }
      ]
    }

    applyExtractedSiteNames(geoJSON, 'shapefile')

    expect(geoJSON.features[0].properties).toEqual({ other: 'value' })
  })

  it('handles a single Feature', () => {
    const feature = {
      type: 'Feature',
      geometry: polygonGeometry,
      properties: { name: 'Single site' }
    }

    applyExtractedSiteNames(feature, 'kml')

    expect(feature.properties.name).toBe('Single site')
  })
})
