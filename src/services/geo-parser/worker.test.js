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
      const workerData = {
        filePath: '/path/to/test.kml',
        fileType: 'kml'
      }
      kmlParser.parseFile.mockResolvedValue(mockGeoJSON)

      await processFile(workerData, mockMessagePort)

      expect(kmlParser.parseFile).toHaveBeenCalledWith('/path/to/test.kml')
      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        geoJSON: mockGeoJSON
      })
    })

    it('should process shapefile successfully', async () => {
      const workerData = {
        filePath: '/path/to/test.zip',
        fileType: 'shapefile'
      }
      shapefileParser.parseFile.mockResolvedValue(mockGeoJSON)

      await processFile(workerData, mockMessagePort)

      expect(shapefileParser.parseFile).toHaveBeenCalledWith(
        '/path/to/test.zip'
      )
      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        geoJSON: mockGeoJSON
      })
    })

    it('should handle unsupported file type', async () => {
      const workerData = {
        filePath: '/path/to/test.pdf',
        fileType: 'pdf'
      }

      await processFile(workerData, mockMessagePort)

      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: 'Unsupported file type: pdf'
      })
      expect(kmlParser.parseFile).not.toHaveBeenCalled()
      expect(shapefileParser.parseFile).not.toHaveBeenCalled()
    })

    it('should handle KML parser errors', async () => {
      const workerData = {
        filePath: '/path/to/invalid.kml',
        fileType: 'kml'
      }
      const parseError = new Error('Invalid KML format')
      kmlParser.parseFile.mockRejectedValue(parseError)

      await processFile(workerData, mockMessagePort)

      expect(kmlParser.parseFile).toHaveBeenCalledWith('/path/to/invalid.kml')
      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: 'Invalid KML format'
      })
    })

    it('should handle shapefile parser errors', async () => {
      const workerData = {
        filePath: '/path/to/invalid.zip',
        fileType: 'shapefile'
      }
      const parseError = new Error('Invalid shapefile format')
      shapefileParser.parseFile.mockRejectedValue(parseError)

      await processFile(workerData, mockMessagePort)

      expect(shapefileParser.parseFile).toHaveBeenCalledWith(
        '/path/to/invalid.zip'
      )
      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: 'Invalid shapefile format'
      })
    })

    it('should handle parser errors with complex error objects', async () => {
      const workerData = {
        filePath: '/path/to/test.kml',
        fileType: 'kml'
      }
      const complexError = new Error('Parse failed')
      complexError.code = 'ENOENT'
      complexError.path = '/path/to/test.kml'
      kmlParser.parseFile.mockRejectedValue(complexError)

      await processFile(workerData, mockMessagePort)

      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: 'Parse failed'
      })
    })

    it('should handle null/undefined workerData gracefully', async () => {
      const workerData = {
        filePath: null,
        fileType: 'kml'
      }

      await processFile(workerData, mockMessagePort)

      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: expect.any(String)
      })
    })

    it('should handle empty file type', async () => {
      const workerData = {
        filePath: '/path/to/test.file',
        fileType: ''
      }

      await processFile(workerData, mockMessagePort)

      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: 'Unsupported file type: '
      })
    })

    it('should handle case sensitivity in file type', async () => {
      const workerData = {
        filePath: '/path/to/test.kml',
        fileType: 'KML'
      }

      await processFile(workerData, mockMessagePort)

      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: 'Unsupported file type: KML'
      })
      expect(kmlParser.parseFile).not.toHaveBeenCalled()
    })

    it('should handle successful parsing with empty GeoJSON', async () => {
      const emptyGeoJSON = {
        type: 'FeatureCollection',
        features: []
      }
      const workerData = {
        filePath: '/path/to/empty.kml',
        fileType: 'kml'
      }
      kmlParser.parseFile.mockResolvedValue(emptyGeoJSON)

      await processFile(workerData, mockMessagePort)

      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        geoJSON: emptyGeoJSON
      })
    })

    it('should handle successful parsing with large GeoJSON', async () => {
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

      await processFile(workerData, mockMessagePort)

      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        geoJSON: largeGeoJSON
      })
      expect(largeGeoJSON.features).toHaveLength(10)
    })

    it('should handle missing fileType', async () => {
      const workerData = {
        filePath: '/path/to/test.kml'
      }

      await processFile(workerData, mockMessagePort)

      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: 'Unsupported file type: undefined'
      })
    })
  })
})
