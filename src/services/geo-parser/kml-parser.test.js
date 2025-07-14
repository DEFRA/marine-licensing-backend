import { KmlParser } from './kml-parser.js'
import { readFile } from 'fs/promises'
import { JSDOM } from 'jsdom'
import * as togeojson from '@tmcw/togeojson'
import Boom from '@hapi/boom'

// Mock file system
jest.mock('fs/promises', () => ({
  readFile: jest.fn()
}))

// Mock JSDOM
jest.mock('jsdom', () => ({
  JSDOM: jest.fn()
}))

// Mock togeojson
jest.mock('@tmcw/togeojson', () => ({
  kml: jest.fn()
}))

// Mock logger
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

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock DOM document
    mockDocument = {
      createElement: jest.fn(),
      documentElement: {}
    }

    // Mock DOM window
    mockWindow = {
      document: mockDocument
    }

    // Mock JSDOM instance
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

    const mockGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-0.1, 51.5]
          },
          properties: {
            name: 'Test Point'
          }
        }
      ]
    }

    beforeEach(() => {
      readFile.mockResolvedValue(mockKmlContent)
      togeojson.kml.mockReturnValue(mockGeoJSON)
    })

    it('should successfully parse KML file', async () => {
      // Given - valid KML file

      // When - parsing file
      const result = await kmlParser.parseFile(filePath)

      // Then - should return GeoJSON
      expect(result).toEqual(mockGeoJSON)
      expect(readFile).toHaveBeenCalledWith(filePath, 'utf-8')
      expect(JSDOM).toHaveBeenCalledWith(mockKmlContent, {
        contentType: 'application/xml'
      })
      expect(togeojson.kml).toHaveBeenCalledWith(mockDocument)
    })

    it('should handle file with multiple placemarks', async () => {
      // Given - KML with multiple placemarks
      const multiFeatureGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-0.1, 51.5]
            },
            properties: {
              name: 'Point 1'
            }
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-0.2, 51.6]
            },
            properties: {
              name: 'Point 2'
            }
          }
        ]
      }
      togeojson.kml.mockReturnValue(multiFeatureGeoJSON)

      // When - parsing file
      const result = await kmlParser.parseFile(filePath)

      // Then - should return GeoJSON with multiple features
      expect(result).toEqual(multiFeatureGeoJSON)
      expect(result.features).toHaveLength(2)
    })

    it('should handle empty KML file', async () => {
      // Given - empty KML file
      const emptyGeoJSON = {
        type: 'FeatureCollection',
        features: []
      }
      togeojson.kml.mockReturnValue(emptyGeoJSON)

      // When - parsing file
      const result = await kmlParser.parseFile(filePath)

      // Then - should return empty GeoJSON
      expect(result).toEqual(emptyGeoJSON)
      expect(result.features).toHaveLength(0)
    })

    it('should handle KML with polygon geometry', async () => {
      // Given - KML with polygon
      const polygonGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
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
            },
            properties: {
              name: 'Test Polygon'
            }
          }
        ]
      }
      togeojson.kml.mockReturnValue(polygonGeoJSON)

      // When - parsing file
      const result = await kmlParser.parseFile(filePath)

      // Then - should return polygon GeoJSON
      expect(result).toEqual(polygonGeoJSON)
      expect(result.features[0].geometry.type).toBe('Polygon')
    })

    it('should handle KML with linestring geometry', async () => {
      // Given - KML with linestring
      const linestringGeoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [-0.1, 51.5],
                [-0.2, 51.6],
                [-0.3, 51.7]
              ]
            },
            properties: {
              name: 'Test Line'
            }
          }
        ]
      }
      togeojson.kml.mockReturnValue(linestringGeoJSON)

      // When - parsing file
      const result = await kmlParser.parseFile(filePath)

      // Then - should return linestring GeoJSON
      expect(result).toEqual(linestringGeoJSON)
      expect(result.features[0].geometry.type).toBe('LineString')
    })

    it('should handle file read errors', async () => {
      // Given - file read fails
      const error = new Error('File not found')
      readFile.mockRejectedValue(error)

      // When/Then - should throw internal server error
      await expect(kmlParser.parseFile(filePath)).rejects.toThrow(
        Boom.internal('KML parsing failed: File not found')
      )
    })

    it('should handle JSDOM creation errors', async () => {
      // Given - JSDOM creation fails
      const error = new Error('Invalid XML')
      JSDOM.mockImplementation(() => {
        throw error
      })

      // When/Then - should throw bad request error
      await expect(kmlParser.parseFile(filePath)).rejects.toThrow(
        Boom.badRequest('Invalid KML file format')
      )
    })

    it('should handle invalid XML format', async () => {
      // Given - invalid XML content
      const invalidXml = 'not valid xml'
      readFile.mockResolvedValue(invalidXml)

      const error = new Error('Invalid XML format')
      JSDOM.mockImplementation(() => {
        throw error
      })

      // When/Then - should throw bad request error
      await expect(kmlParser.parseFile(filePath)).rejects.toThrow(
        Boom.badRequest('Invalid KML file format')
      )
    })

    it('should handle togeojson conversion errors', async () => {
      // Given - togeojson conversion fails
      const error = new Error('Conversion failed')
      togeojson.kml.mockImplementation(() => {
        throw error
      })

      // When/Then - should throw internal server error
      await expect(kmlParser.parseFile(filePath)).rejects.toThrow(
        Boom.internal('KML parsing failed: Conversion failed')
      )
    })

    it('should handle empty file', async () => {
      // Given - empty file content
      readFile.mockResolvedValue('')

      const error = new Error('Empty document')
      JSDOM.mockImplementation(() => {
        throw error
      })

      // When/Then - should throw internal server error
      await expect(kmlParser.parseFile(filePath)).rejects.toThrow(
        Boom.internal('KML parsing failed: Empty document')
      )
    })

    it('should handle malformed KML structure', async () => {
      // Given - malformed KML structure
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

      // When - parsing malformed file
      const result = await kmlParser.parseFile(filePath)

      // Then - should return empty GeoJSON
      expect(result).toEqual(emptyGeoJSON)
    })

    it('should handle KML with extended data', async () => {
      // Given - KML with extended data
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

      // When - parsing file
      const result = await kmlParser.parseFile(filePath)

      // Then - should preserve extended data
      expect(result).toEqual(extendedDataGeoJSON)
      expect(result.features[0].properties.customProperty).toBe('custom value')
    })

    it('should handle KML with different coordinate systems', async () => {
      // Given - KML with different coordinate system
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

      // When - parsing file
      const result = await kmlParser.parseFile(filePath)

      // Then - should handle different coordinates
      expect(result).toEqual(coordinateSystemGeoJSON)
      expect(result.features[0].geometry.coordinates).toEqual([123.456, 12.345])
    })

    it('should handle very large KML files', async () => {
      // Given - large KML content
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

      // When - parsing large file
      const result = await kmlParser.parseFile(filePath)

      // Then - should handle large file
      expect(result).toEqual(largeGeoJSON)
      expect(result.features).toHaveLength(1000)
    })

    it('should handle KML with namespaces', async () => {
      // Given - KML with different namespace
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

      // When - parsing namespaced file
      const result = await kmlParser.parseFile(filePath)

      // Then - should handle namespaces
      expect(result).toEqual(mockGeoJSON)
      expect(JSDOM).toHaveBeenCalledWith(namespacedKml, {
        contentType: 'application/xml'
      })
    })

    it('should handle permission errors', async () => {
      // Given - permission error
      const error = new Error('Permission denied')
      error.code = 'EACCES'
      readFile.mockRejectedValue(error)

      // When/Then - should throw internal server error
      await expect(kmlParser.parseFile(filePath)).rejects.toThrow(
        Boom.internal('KML parsing failed: Permission denied')
      )
    })

    it('should handle file not found errors', async () => {
      // Given - file not found
      const error = new Error('File not found')
      error.code = 'ENOENT'
      readFile.mockRejectedValue(error)

      // When/Then - should throw internal server error
      await expect(kmlParser.parseFile(filePath)).rejects.toThrow(
        Boom.internal('KML parsing failed: File not found')
      )
    })
  })

  describe('Constructor', () => {
    it('should create KmlParser instance', () => {
      // Given - KmlParser constructor
      const parser = new KmlParser()

      // Then - should create instance
      expect(parser).toBeInstanceOf(KmlParser)
    })
  })

  describe('Error handling edge cases', () => {
    it('should handle null file content', async () => {
      // Given - null file content
      readFile.mockResolvedValue(null)

      const error = new Error('Cannot read null content')
      JSDOM.mockImplementation(() => {
        throw error
      })

      // When/Then - should throw internal server error
      await expect(kmlParser.parseFile('/tmp/test.kml')).rejects.toThrow(
        Boom.internal('KML parsing failed: Cannot read null content')
      )
    })

    it('should handle undefined file content', async () => {
      // Given - undefined file content
      readFile.mockResolvedValue(undefined)

      const error = new Error('Cannot read undefined content')
      JSDOM.mockImplementation(() => {
        throw error
      })

      // When/Then - should throw internal server error
      await expect(kmlParser.parseFile('/tmp/test.kml')).rejects.toThrow(
        Boom.internal('KML parsing failed: Cannot read undefined content')
      )
    })

    it('should handle memory errors during parsing', async () => {
      // Given - memory error
      const error = new Error('JavaScript heap out of memory')
      togeojson.kml.mockImplementation(() => {
        throw error
      })

      // When/Then - should throw internal server error
      await expect(kmlParser.parseFile('/tmp/test.kml')).rejects.toThrow(
        Boom.internal('KML parsing failed: JavaScript heap out of memory')
      )
    })
  })
})
