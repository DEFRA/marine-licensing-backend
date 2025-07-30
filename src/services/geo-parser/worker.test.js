import { kmlParser } from './kml-parser.js'
import { shapefileParser } from './shapefile-parser.js'
import { processFile } from './worker.js'

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

  const createWorkerData = (filePath, fileType) => ({ filePath, fileType })

  const createGeoJSON = (features = []) => ({
    type: 'FeatureCollection',
    features
  })

  const createFeature = (coordinates, properties = {}) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates
    },
    properties
  })

  const expectSuccessMessage = (geoJSON) => {
    expect(mockMessagePort.postMessage).toHaveBeenCalledWith({ geoJSON })
  }

  const expectErrorMessage = (error) => {
    expect(mockMessagePort.postMessage).toHaveBeenCalledWith({ error })
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockMessagePort = {
      postMessage: jest.fn()
    }
  })

  const mockGeoJSON = createGeoJSON([createFeature([-0.1, 51.5])])

  describe('processFile function', () => {
    it('should process KML file successfully', async () => {
      const workerData = createWorkerData('/path/to/test.kml', 'kml')
      kmlParser.parseFile.mockResolvedValue(mockGeoJSON)

      await processFile(workerData, mockMessagePort)

      expect(kmlParser.parseFile).toHaveBeenCalledWith('/path/to/test.kml')
      expectSuccessMessage(mockGeoJSON)
    })

    it('should process shapefile successfully', async () => {
      const workerData = createWorkerData('/path/to/test.zip', 'shapefile')
      shapefileParser.parseFile.mockResolvedValue(mockGeoJSON)

      await processFile(workerData, mockMessagePort)

      expect(shapefileParser.parseFile).toHaveBeenCalledWith(
        '/path/to/test.zip'
      )
      expectSuccessMessage(mockGeoJSON)
    })

    it('should handle unsupported file type', async () => {
      const workerData = createWorkerData('/path/to/test.pdf', 'pdf')

      await processFile(workerData, mockMessagePort)

      expectErrorMessage('Unsupported file type: pdf')
      expect(kmlParser.parseFile).not.toHaveBeenCalled()
      expect(shapefileParser.parseFile).not.toHaveBeenCalled()
    })

    it('should handle KML parser errors', async () => {
      const workerData = createWorkerData('/path/to/invalid.kml', 'kml')
      const parseError = new Error('Invalid KML format')
      kmlParser.parseFile.mockRejectedValue(parseError)

      await processFile(workerData, mockMessagePort)

      expect(kmlParser.parseFile).toHaveBeenCalledWith('/path/to/invalid.kml')
      expectErrorMessage('Invalid KML format')
    })

    it('should handle shapefile parser errors', async () => {
      const workerData = createWorkerData('/path/to/invalid.zip', 'shapefile')
      const parseError = new Error('Invalid shapefile format')
      shapefileParser.parseFile.mockRejectedValue(parseError)

      await processFile(workerData, mockMessagePort)

      expect(shapefileParser.parseFile).toHaveBeenCalledWith(
        '/path/to/invalid.zip'
      )
      expectErrorMessage('Invalid shapefile format')
    })

    it('should handle parser errors with complex error objects', async () => {
      const workerData = createWorkerData('/path/to/test.kml', 'kml')
      const complexError = new Error('Parse failed')
      complexError.code = 'ENOENT'
      complexError.path = '/path/to/test.kml'
      kmlParser.parseFile.mockRejectedValue(complexError)

      await processFile(workerData, mockMessagePort)

      expectErrorMessage('Parse failed')
    })

    it('should handle null/undefined workerData gracefully', async () => {
      const workerData = createWorkerData(null, 'kml')

      await processFile(workerData, mockMessagePort)

      expect(mockMessagePort.postMessage).toHaveBeenCalledWith({
        error: expect.any(String)
      })
    })

    it('should handle empty file type', async () => {
      const workerData = createWorkerData('/path/to/test.file', '')

      await processFile(workerData, mockMessagePort)

      expectErrorMessage('Unsupported file type: ')
    })

    it('should handle case sensitivity in file type', async () => {
      const workerData = createWorkerData('/path/to/test.kml', 'KML')

      await processFile(workerData, mockMessagePort)

      expectErrorMessage('Unsupported file type: KML')
      expect(kmlParser.parseFile).not.toHaveBeenCalled()
    })

    it('should handle successful parsing with empty GeoJSON', async () => {
      const emptyGeoJSON = createGeoJSON([])
      const workerData = createWorkerData('/path/to/empty.kml', 'kml')
      kmlParser.parseFile.mockResolvedValue(emptyGeoJSON)

      await processFile(workerData, mockMessagePort)

      expectSuccessMessage(emptyGeoJSON)
    })

    it('should handle successful parsing with large GeoJSON', async () => {
      const largeFeatures = Array.from({ length: 10 }, (_, i) =>
        createFeature([i * 0.001, i * 0.001], { id: i })
      )
      const largeGeoJSON = createGeoJSON(largeFeatures)
      const workerData = createWorkerData('/path/to/large.kml', 'kml')
      kmlParser.parseFile.mockResolvedValue(largeGeoJSON)

      await processFile(workerData, mockMessagePort)

      expectSuccessMessage(largeGeoJSON)
      expect(largeGeoJSON.features).toHaveLength(10)
    })

    it('should handle missing fileType', async () => {
      const workerData = { filePath: '/path/to/test.kml' }

      await processFile(workerData, mockMessagePort)

      expectErrorMessage('Unsupported file type: undefined')
    })

    it('should handle completely undefined workerData', async () => {
      await processFile(undefined, mockMessagePort)

      expectErrorMessage("Cannot read properties of null (reading 'filePath')")
    })

    it('should handle null workerData', async () => {
      await processFile(null, mockMessagePort)

      expectErrorMessage("Cannot read properties of null (reading 'filePath')")
    })

    it('should handle undefined messagePort and throw error', async () => {
      const workerData = createWorkerData('/path/to/test.kml', 'kml')
      kmlParser.parseFile.mockResolvedValue(mockGeoJSON)

      await expect(processFile(workerData, undefined)).rejects.toThrow(
        "Cannot read properties of null (reading 'postMessage')"
      )
    })

    it('should handle null messagePort and throw error', async () => {
      const workerData = createWorkerData('/path/to/test.kml', 'kml')
      kmlParser.parseFile.mockResolvedValue(mockGeoJSON)

      await expect(processFile(workerData, null)).rejects.toThrow(
        "Cannot read properties of null (reading 'postMessage')"
      )
    })

    it('should handle empty workerData object', async () => {
      const workerData = {}

      await processFile(workerData, mockMessagePort)

      expectErrorMessage('Unsupported file type: undefined')
    })

    it('should handle workerData with only filePath', async () => {
      const workerData = { filePath: '/path/to/test.kml' }

      await processFile(workerData, mockMessagePort)

      expectErrorMessage('Unsupported file type: undefined')
      expect(kmlParser.parseFile).not.toHaveBeenCalled()
      expect(shapefileParser.parseFile).not.toHaveBeenCalled()
    })

    it('should handle workerData with only fileType', async () => {
      const workerData = { fileType: 'kml' }
      kmlParser.parseFile.mockRejectedValue(new Error('File path is required'))

      await processFile(workerData, mockMessagePort)

      expect(kmlParser.parseFile).toHaveBeenCalledWith(undefined)
      expectErrorMessage('File path is required')
    })
  })
})
