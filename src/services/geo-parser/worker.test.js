import { processFile } from './worker.js'
import { kmlParser } from './kml-parser.js'
import { shapefileParser } from './shapefile-parser.js'

// Mock parsers
jest.mock('./kml-parser.js', () => ({
  kmlParser: {
    parseFile: jest.fn()
  }
}))

jest.mock('./shapefile-parser.js', () => ({
  shapefileParser: {
    parseFile: jest.fn()
  }
}))

describe('Worker', () => {
  let mockMessagePort

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock message port
    mockMessagePort = {
      postMessage: jest.fn()
    }
  })

  const mockGeoJSON = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [-0.1, 51.5]
        },
        properties: {}
      }
    ]
  }

  describe('processFile function', () => {
    it('should process KML file successfully', async () => {
      // Given - KML file data
      const workerData = {
        filePath: '/path/to/test.kml',
        fileType: 'kml'
      }
      kmlParser.parseFile.mockResolvedValue(mockGeoJSON)

      // When - processing file
      await processFile(workerData, mockMessagePort)

      // Then - should parse KML and send success message
      expect(kmlParser.parseFile).toHaveBeenCalledWith('/path/to/test.kml')
      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        geoJSON: mockGeoJSON
      })
    })

    it('should process shapefile successfully', async () => {
      // Given - shapefile data
      const workerData = {
        filePath: '/path/to/test.zip',
        fileType: 'shapefile'
      }
      shapefileParser.parseFile.mockResolvedValue(mockGeoJSON)

      // When - processing file
      await processFile(workerData, mockMessagePort)

      // Then - should parse shapefile and send success message
      expect(shapefileParser.parseFile).toHaveBeenCalledWith(
        '/path/to/test.zip'
      )
      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        geoJSON: mockGeoJSON
      })
    })

    it('should handle unsupported file type', async () => {
      // Given - unsupported file type
      const workerData = {
        filePath: '/path/to/test.pdf',
        fileType: 'pdf'
      }

      // When - processing file
      await processFile(workerData, mockMessagePort)

      // Then - should send error message
      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: 'Unsupported file type: pdf'
      })
      expect(kmlParser.parseFile).not.toHaveBeenCalled()
      expect(shapefileParser.parseFile).not.toHaveBeenCalled()
    })

    it('should handle KML parser errors', async () => {
      // Given - KML parser throws error
      const workerData = {
        filePath: '/path/to/invalid.kml',
        fileType: 'kml'
      }
      const parseError = new Error('Invalid KML format')
      kmlParser.parseFile.mockRejectedValue(parseError)

      // When - processing file
      await processFile(workerData, mockMessagePort)

      // Then - should send error message
      expect(kmlParser.parseFile).toHaveBeenCalledWith('/path/to/invalid.kml')
      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: 'Invalid KML format'
      })
    })

    it('should handle shapefile parser errors', async () => {
      // Given - shapefile parser throws error
      const workerData = {
        filePath: '/path/to/invalid.zip',
        fileType: 'shapefile'
      }
      const parseError = new Error('Invalid shapefile format')
      shapefileParser.parseFile.mockRejectedValue(parseError)

      // When - processing file
      await processFile(workerData, mockMessagePort)

      // Then - should send error message
      expect(shapefileParser.parseFile).toHaveBeenCalledWith(
        '/path/to/invalid.zip'
      )
      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: 'Invalid shapefile format'
      })
    })

    it('should handle parser errors with complex error objects', async () => {
      // Given - parser throws complex error
      const workerData = {
        filePath: '/path/to/test.kml',
        fileType: 'kml'
      }
      const complexError = new Error('Parse failed')
      complexError.code = 'ENOENT'
      complexError.path = '/path/to/test.kml'
      kmlParser.parseFile.mockRejectedValue(complexError)

      // When - processing file
      await processFile(workerData, mockMessagePort)

      // Then - should send error message with error.message
      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: 'Parse failed'
      })
    })

    it('should handle null/undefined workerData gracefully', async () => {
      // Given - invalid worker data
      const workerData = {
        filePath: null,
        fileType: 'kml'
      }

      // When - processing file
      await processFile(workerData, mockMessagePort)

      // Then - should handle the error
      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: expect.any(String)
      })
    })

    it('should handle empty file type', async () => {
      // Given - empty file type
      const workerData = {
        filePath: '/path/to/test.file',
        fileType: ''
      }

      // When - processing file
      await processFile(workerData, mockMessagePort)

      // Then - should send error message
      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: 'Unsupported file type: '
      })
    })

    it('should handle case sensitivity in file type', async () => {
      // Given - uppercase file type
      const workerData = {
        filePath: '/path/to/test.kml',
        fileType: 'KML'
      }

      // When - processing file
      await processFile(workerData, mockMessagePort)

      // Then - should send error message (case sensitive)
      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: 'Unsupported file type: KML'
      })
      expect(kmlParser.parseFile).not.toHaveBeenCalled()
    })

    it('should handle successful parsing with empty GeoJSON', async () => {
      // Given - parser returns empty GeoJSON
      const emptyGeoJSON = {
        type: 'FeatureCollection',
        features: []
      }
      const workerData = {
        filePath: '/path/to/empty.kml',
        fileType: 'kml'
      }
      kmlParser.parseFile.mockResolvedValue(emptyGeoJSON)

      // When - processing file
      await processFile(workerData, mockMessagePort)

      // Then - should send success message with empty GeoJSON
      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        geoJSON: emptyGeoJSON
      })
    })

    it('should handle successful parsing with large GeoJSON', async () => {
      // Given - parser returns large GeoJSON
      const largeGeoJSON = {
        type: 'FeatureCollection',
        features: Array.from({ length: 10 }, (_, i) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [i * 0.001, i * 0.001]
          },
          properties: { id: i }
        }))
      }
      const workerData = {
        filePath: '/path/to/large.kml',
        fileType: 'kml'
      }
      kmlParser.parseFile.mockResolvedValue(largeGeoJSON)

      // When - processing file
      await processFile(workerData, mockMessagePort)

      // Then - should send success message with large GeoJSON
      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        geoJSON: largeGeoJSON
      })
      expect(largeGeoJSON.features).toHaveLength(10)
    })

    it('should handle missing fileType', async () => {
      // Given - missing fileType
      const workerData = {
        filePath: '/path/to/test.kml'
      }

      // When - processing file
      await processFile(workerData, mockMessagePort)

      // Then - should handle the error
      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: 'Unsupported file type: undefined'
      })
    })
  })
})
