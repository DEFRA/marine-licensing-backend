import Boom from '@hapi/boom'
import * as togeojson from '@tmcw/togeojson'
import { readFile } from 'fs/promises'
import { JSDOM } from 'jsdom'
import { KmlParser } from './kml-parser.js'

jest.mock('fs/promises', () => ({
  readFile: jest.fn()
}))

jest.mock('jsdom', () => ({
  JSDOM: jest.fn()
}))

jest.mock('@tmcw/togeojson', () => ({
  kml: jest.fn()
}))

jest.mock('../../common/helpers/logging/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    error: jest.fn()
  }))
}))

describe('KmlParser', () => {
  let kmlParser
  let mockDocument
  let mockWindow

  const createFeature = (geometry, properties = {}) => ({
    type: 'Feature',
    geometry,
    properties
  })

  const createFeatureCollection = (features) => ({
    type: 'FeatureCollection',
    features
  })

  const createPointGeometry = (coordinates) => ({
    type: 'Point',
    coordinates
  })

  const createPolygonGeometry = (coordinates) => ({
    type: 'Polygon',
    coordinates
  })

  const createLineStringGeometry = (coordinates) => ({
    type: 'LineString',
    coordinates
  })

  const setupMockAndTest = async (
    mockGeoJSON,
    filePath = '/tmp/test-file.kml'
  ) => {
    togeojson.kml.mockReturnValue(mockGeoJSON)
    return await kmlParser.parseFile(filePath)
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockDocument = {
      createElement: jest.fn(),
      documentElement: {}
    }

    mockWindow = {
      document: mockDocument
    }

    JSDOM.mockReturnValue({
      window: mockWindow
    })

    kmlParser = new KmlParser()
  })

  describe('parseFile', () => {
    const filePath = '/tmp/test-file.kml'
    const mockKmlContent = `<?xml version="1.0" encoding="UTF-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <Placemark>
            <name>Test Point</name>
            <Point>
              <coordinates>-0.1,51.5,0</coordinates>
            </Point>
          </Placemark>
        </Document>
      </kml>`

    const mockGeoJSON = createFeatureCollection([
      createFeature(createPointGeometry([-0.1, 51.5]), { name: 'Test Point' })
    ])

    beforeEach(() => {
      readFile.mockResolvedValue(mockKmlContent)
      togeojson.kml.mockReturnValue(mockGeoJSON)
    })

    it('should successfully parse KML file', async () => {
      const result = await kmlParser.parseFile(filePath)

      expect(result).toEqual(mockGeoJSON)
      expect(readFile).toHaveBeenCalledWith(filePath, 'utf-8')
      expect(JSDOM).toHaveBeenCalledWith(mockKmlContent, {
        contentType: 'application/xml'
      })
      expect(togeojson.kml).toHaveBeenCalledWith(mockDocument)
    })

    it('should handle file with multiple placemarks', async () => {
      const multiFeatureGeoJSON = createFeatureCollection([
        createFeature(createPointGeometry([-0.1, 51.5]), { name: 'Point 1' }),
        createFeature(createPointGeometry([-0.2, 51.6]), { name: 'Point 2' })
      ])

      const result = await setupMockAndTest(multiFeatureGeoJSON, filePath)

      expect(result).toEqual(multiFeatureGeoJSON)
      expect(result.features).toHaveLength(2)
    })

    it('should handle empty KML file', async () => {
      const emptyGeoJSON = createFeatureCollection([])

      const result = await setupMockAndTest(emptyGeoJSON, filePath)

      expect(result).toEqual(emptyGeoJSON)
      expect(result.features).toHaveLength(0)
    })

    it('should handle KML with polygon geometry', async () => {
      const polygonCoords = [
        [
          [-0.1, 51.5],
          [-0.2, 51.5],
          [-0.2, 51.6],
          [-0.1, 51.6],
          [-0.1, 51.5]
        ]
      ]
      const polygonGeoJSON = createFeatureCollection([
        createFeature(createPolygonGeometry(polygonCoords), {
          name: 'Test Polygon'
        })
      ])

      const result = await setupMockAndTest(polygonGeoJSON, filePath)

      expect(result).toEqual(polygonGeoJSON)
      expect(result.features[0].geometry.type).toBe('Polygon')
    })

    it('should handle KML with linestring geometry', async () => {
      const lineCoords = [
        [-0.1, 51.5],
        [-0.2, 51.6],
        [-0.3, 51.7]
      ]
      const linestringGeoJSON = createFeatureCollection([
        createFeature(createLineStringGeometry(lineCoords), {
          name: 'Test Line'
        })
      ])

      const result = await setupMockAndTest(linestringGeoJSON, filePath)

      expect(result).toEqual(linestringGeoJSON)
      expect(result.features[0].geometry.type).toBe('LineString')
    })

    it('should handle file read errors', async () => {
      const error = new Error('File not found')
      readFile.mockRejectedValue(error)

      await expect(kmlParser.parseFile(filePath)).rejects.toThrow(
        Boom.internal('KML parsing failed: File not found')
      )
    })

    it('should handle JSDOM creation errors', async () => {
      const error = new Error('Invalid XML')
      JSDOM.mockImplementation(() => {
        throw error
      })

      await expect(kmlParser.parseFile(filePath)).rejects.toThrow(
        Boom.badRequest('Invalid KML file format')
      )
    })

    it('should handle invalid XML format', async () => {
      const invalidXml = 'not valid xml'
      readFile.mockResolvedValue(invalidXml)

      const error = new Error('Invalid XML format')
      JSDOM.mockImplementation(() => {
        throw error
      })

      await expect(kmlParser.parseFile(filePath)).rejects.toThrow(
        Boom.badRequest('Invalid KML file format')
      )
    })

    it('should handle togeojson conversion errors', async () => {
      const error = new Error('Conversion failed')
      togeojson.kml.mockImplementation(() => {
        throw error
      })

      await expect(kmlParser.parseFile(filePath)).rejects.toThrow(
        Boom.internal('KML parsing failed: Conversion failed')
      )
    })

    it('should handle empty file', async () => {
      readFile.mockResolvedValue('')

      const error = new Error('Empty document')
      JSDOM.mockImplementation(() => {
        throw error
      })

      await expect(kmlParser.parseFile(filePath)).rejects.toThrow(
        Boom.internal('KML parsing failed: Empty document')
      )
    })

    it('should handle malformed KML structure', async () => {
      const malformedKml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Test Point</name>
              <!-- Missing Point element -->
            </Placemark>
          </Document>
        </kml>`
      readFile.mockResolvedValue(malformedKml)

      // togeojson might return empty features for malformed KML
      const emptyGeoJSON = {
        type: 'FeatureCollection',
        features: []
      }
      togeojson.kml.mockReturnValue(emptyGeoJSON)

      const result = await kmlParser.parseFile(filePath)

      expect(result).toEqual(emptyGeoJSON)
    })

    it('should handle KML with extended data', async () => {
      const extendedDataGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-0.1, 51.5]
            },
            properties: {
              name: 'Test Point',
              description: 'Test description',
              customProperty: 'custom value'
            }
          }
        ]
      }
      togeojson.kml.mockReturnValue(extendedDataGeoJSON)

      const result = await kmlParser.parseFile(filePath)

      expect(result).toEqual(extendedDataGeoJSON)
      expect(result.features[0].properties.customProperty).toBe('custom value')
    })

    it('should handle KML with different coordinate systems', async () => {
      const coordinateSystemGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [123.456, 12.345]
            },
            properties: {
              name: 'Different coordinates'
            }
          }
        ]
      }
      togeojson.kml.mockReturnValue(coordinateSystemGeoJSON)

      const result = await kmlParser.parseFile(filePath)

      expect(result).toEqual(coordinateSystemGeoJSON)
      expect(result.features[0].geometry.coordinates).toEqual([123.456, 12.345])
    })

    it('should handle very large KML files', async () => {
      const largeKml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            ${'<Placemark><name>Point</name><Point><coordinates>-0.1,51.5,0</coordinates></Point></Placemark>'.repeat(1000)}
          </Document>
        </kml>`
      readFile.mockResolvedValue(largeKml)

      const largeGeoJSON = {
        type: 'FeatureCollection',
        features: Array(1000).fill({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-0.1, 51.5]
          },
          properties: {
            name: 'Point'
          }
        })
      }
      togeojson.kml.mockReturnValue(largeGeoJSON)

      const result = await kmlParser.parseFile(filePath)

      expect(result).toEqual(largeGeoJSON)
      expect(result.features).toHaveLength(1000)
    })

    it('should handle KML with namespaces', async () => {
      const namespacedKml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
          <Document>
            <Placemark>
              <name>Test Point</name>
              <Point>
                <coordinates>-0.1,51.5,0</coordinates>
              </Point>
            </Placemark>
          </Document>
        </kml>`
      readFile.mockResolvedValue(namespacedKml)

      const result = await kmlParser.parseFile(filePath)

      expect(result).toEqual(mockGeoJSON)
      expect(JSDOM).toHaveBeenCalledWith(namespacedKml, {
        contentType: 'application/xml'
      })
    })

    it('should handle permission errors', async () => {
      const error = new Error('Permission denied')
      error.code = 'EACCES'
      readFile.mockRejectedValue(error)

      await expect(kmlParser.parseFile(filePath)).rejects.toThrow(
        Boom.internal('KML parsing failed: Permission denied')
      )
    })

    it('should handle file not found errors', async () => {
      const error = new Error('File not found')
      error.code = 'ENOENT'
      readFile.mockRejectedValue(error)

      await expect(kmlParser.parseFile(filePath)).rejects.toThrow(
        Boom.internal('KML parsing failed: File not found')
      )
    })
  })

  describe('Constructor', () => {
    it('should create KmlParser instance', () => {
      const parser = new KmlParser()

      expect(parser).toBeInstanceOf(KmlParser)
    })
  })

  describe('Error handling edge cases', () => {
    it('should handle null file content', async () => {
      readFile.mockResolvedValue(null)

      const error = new Error('Cannot read null content')
      JSDOM.mockImplementation(() => {
        throw error
      })

      await expect(kmlParser.parseFile('/tmp/test.kml')).rejects.toThrow(
        Boom.internal('KML parsing failed: Cannot read null content')
      )
    })

    it('should handle undefined file content', async () => {
      readFile.mockResolvedValue(undefined)

      const error = new Error('Cannot read undefined content')
      JSDOM.mockImplementation(() => {
        throw error
      })

      await expect(kmlParser.parseFile('/tmp/test.kml')).rejects.toThrow(
        Boom.internal('KML parsing failed: Cannot read undefined content')
      )
    })

    it('should handle memory errors during parsing', async () => {
      const error = new Error('JavaScript heap out of memory')
      togeojson.kml.mockImplementation(() => {
        throw error
      })

      await expect(kmlParser.parseFile('/tmp/test.kml')).rejects.toThrow(
        Boom.internal('KML parsing failed: JavaScript heap out of memory')
      )
    })
  })
})
