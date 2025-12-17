import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import Hapi from '@hapi/hapi'
import Wreck from '@hapi/wreck'
import { config } from '../config.js'
import { populateCoastalEnforcementAreasPlugin } from './populate-coastal-enforcement-areas.js'
import { formatGeoForStorage } from '../common/helpers/geo/geo-transforms.js'

vi.mock('@hapi/wreck')
vi.mock('../config.js')
vi.mock('../common/helpers/geo/geo-transforms.js')

describe('populateCoastalEnforcementAreasPlugin Plugin', () => {
  let server
  let mockWreckGet
  let mockLogger
  let mockDb
  let mockPayload

  beforeEach(async () => {
    vi.clearAllMocks()

    mockWreckGet = vi.mocked(Wreck.get)

    server = Hapi.server()

    mockPayload = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { id: 1 }, geometry: {} },
        { type: 'Feature', properties: { id: 2 }, geometry: {} }
      ]
    }

    mockLogger = {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn()
    }

    mockDb = {
      collection: vi.fn()
    }

    server.decorate('server', 'logger', mockLogger)
    server.decorate('server', 'db', mockDb)

    vi.mocked(config.get).mockReturnValue({
      coastalEnforcementArea: {
        geoJsonUrl: 'http://localhost:3000/coastal-enforcement-areas.json',
        refreshCoastalEnforcementArea: false
      }
    })
  })

  afterEach(async () => {
    await server?.stop()
  })

  describe('Configuration validation', () => {
    test('should log error and return early when geoJsonUrl is blank', async () => {
      vi.mocked(config.get).mockReturnValue({
        coastalEnforcementArea: {
          geoJsonUrl: '',
          refreshCoastalEnforcementArea: false
        }
      })

      await server.register(populateCoastalEnforcementAreasPlugin)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Coastal Enforcement Areas API URL not configured'
      )
      expect(mockDb.collection).not.toHaveBeenCalled()
    })

    test('should log error and return early when coastalEnforcementArea is undefined', async () => {
      vi.mocked(config.get).mockReturnValue({
        coastalEnforcementArea: undefined,
        refreshCoastalEnforcementArea: false
      })

      await server.register(populateCoastalEnforcementAreasPlugin)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Coastal Enforcement Areas API URL not configured'
      )
      expect(mockDb.collection).not.toHaveBeenCalled()
    })
  })

  describe('populate database functionality', () => {
    test('should log info and return early when collection already has documents', async () => {
      const mockCollection = {
        countDocuments: vi.fn().mockResolvedValue(5)
      }

      mockDb.collection.mockReturnValue(mockCollection)

      await server.register(populateCoastalEnforcementAreasPlugin)

      expect(mockCollection.countDocuments).toHaveBeenCalled()
      expect(mockWreckGet).not.toHaveBeenCalled()
    })

    test('should log error when response has no features', async () => {
      const mockCollection = {
        countDocuments: vi.fn().mockResolvedValue(0)
      }

      mockDb.collection.mockReturnValue(mockCollection)

      mockWreckGet.mockResolvedValue({
        payload: {}
      })

      await server.register(populateCoastalEnforcementAreasPlugin)

      expect(mockWreckGet).toHaveBeenCalledWith(
        'http://localhost:3000/coastal-enforcement-areas.json',
        { json: true }
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          error: {
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'An internal server error occurred'
          }
        },
        'Failed to populate Coastal Enforcement Areas collection'
      )
    })

    test('should successfully fetch and insert features', async () => {
      const mockCollection = {
        deleteMany: vi.fn(),
        countDocuments: vi.fn().mockResolvedValue(0),
        insertMany: vi.fn().mockResolvedValue({})
      }

      mockDb.collection.mockReturnValue(mockCollection)

      const mockFormattedFeatures = [
        { id: 1, geometry: {} },
        { id: 2, geometry: {} }
      ]

      mockWreckGet.mockResolvedValue({
        payload: mockPayload
      })

      vi.mocked(formatGeoForStorage).mockReturnValue(mockFormattedFeatures)

      await server.register(populateCoastalEnforcementAreasPlugin)

      expect(formatGeoForStorage).toHaveBeenCalledWith(mockPayload)
      expect(mockCollection.deleteMany).not.toHaveBeenCalled()
      expect(mockCollection.insertMany).toHaveBeenCalledWith(
        mockFormattedFeatures
      )
    })

    test('should log error when formatGeoForStorage throws an error', async () => {
      const mockCollection = {
        countDocuments: vi.fn().mockResolvedValue(0)
      }

      mockDb.collection.mockReturnValue(mockCollection)

      mockPayload = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { id: 1 }, geometry: {} }]
      }

      mockWreckGet.mockResolvedValue({
        payload: mockPayload
      })

      const formatError = new Error('Failed to format GeoJSON')
      vi.mocked(formatGeoForStorage).mockImplementation(() => {
        throw formatError
      })

      await server.register(populateCoastalEnforcementAreasPlugin)

      expect(formatGeoForStorage).toHaveBeenCalledWith(mockPayload)
      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          error: 'Failed to format GeoJSON'
        },
        'Failed to populate Coastal Enforcement Areas collection'
      )
    })
  })

  describe('Refresh functionality', () => {
    test('should clear and refresh collection when refreshCoastalEnforcementArea is true', async () => {
      const mockCollection = {
        countDocuments: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({}),
        insertMany: vi.fn().mockResolvedValue({})
      }

      vi.mocked(config.get).mockReturnValue({
        coastalEnforcementArea: {
          geoJsonUrl: 'http://localhost:3000/coastal-enforcement-areas.json',
          refreshCoastalEnforcementArea: true
        }
      })

      mockDb.collection.mockReturnValue(mockCollection)

      const mockFormattedFeatures = [
        { id: 1, geometry: {} },
        { id: 2, geometry: {} }
      ]

      mockWreckGet.mockResolvedValue({
        payload: mockPayload
      })

      vi.mocked(formatGeoForStorage).mockReturnValue(mockFormattedFeatures)

      await server.register(populateCoastalEnforcementAreasPlugin)

      expect(mockCollection.deleteMany).toHaveBeenCalledWith({})
      expect(mockCollection.countDocuments).not.toHaveBeenCalled()
      expect(mockWreckGet).toHaveBeenCalledWith(
        'http://localhost:3000/coastal-enforcement-areas.json',
        { json: true }
      )
      expect(mockCollection.insertMany).toHaveBeenCalledWith(
        mockFormattedFeatures
      )
    })
  })
})
