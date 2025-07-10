import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { getMultipleCoordinatesController } from './multiple-coordinates.js'
import { COORDINATE_SYSTEMS } from '../../../common/constants/coordinates.js'

describe('Multiple Coordinates Controllers', () => {
  let mockDb
  let mockHandler
  let mockExemptionId

  beforeEach(() => {
    jest.resetAllMocks()

    mockExemptionId = new ObjectId().toHexString()

    mockHandler = {
      response: jest.fn().mockReturnThis(),
      code: jest.fn().mockReturnThis()
    }

    mockDb = {
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn(),
        updateOne: jest.fn()
      })
    }
  })

  describe('GET Multiple Coordinates Controller', () => {
    describe('Success Scenarios', () => {
      it('should return empty coordinates when exemption exists but has no coordinates', async () => {
        const mockExemption = {
          _id: ObjectId.createFromHexString(mockExemptionId),
          projectName: 'Test Project'
          // No multipleCoordinates field
        }

        mockDb.collection().findOne.mockResolvedValue(mockExemption)

        await getMultipleCoordinatesController.handler(
          { params: { exemptionId: mockExemptionId }, db: mockDb },
          mockHandler
        )

        expect(mockHandler.response).toHaveBeenCalledWith({
          message: 'success',
          value: {
            exemptionId: mockExemptionId,
            coordinateSystem: null,
            coordinates: []
          }
        })
        expect(mockHandler.code).toHaveBeenCalledWith(200)
      })

      it('should return WGS84 coordinates in correct order', async () => {
        const mockExemption = {
          _id: ObjectId.createFromHexString(mockExemptionId),
          projectName: 'Test Project',
          multipleCoordinates: {
            coordinateSystem: COORDINATE_SYSTEMS.WGS84,
            coordinates: [
              { latitude: '55.123456', longitude: '-1.234567' },
              { latitude: '55.234567', longitude: '-1.345678' },
              { latitude: '55.345678', longitude: '-1.456789' }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }

        mockDb.collection().findOne.mockResolvedValue(mockExemption)

        await getMultipleCoordinatesController.handler(
          { params: { exemptionId: mockExemptionId }, db: mockDb },
          mockHandler
        )

        expect(mockHandler.response).toHaveBeenCalledWith({
          message: 'success',
          value: {
            exemptionId: mockExemptionId,
            coordinateSystem: COORDINATE_SYSTEMS.WGS84,
            coordinates: [
              { latitude: '55.123456', longitude: '-1.234567' },
              { latitude: '55.234567', longitude: '-1.345678' },
              { latitude: '55.345678', longitude: '-1.456789' }
            ]
          }
        })
        expect(mockHandler.code).toHaveBeenCalledWith(200)
      })

      it('should return OSGB36 coordinates in correct order', async () => {
        const mockExemption = {
          _id: ObjectId.createFromHexString(mockExemptionId),
          projectName: 'Test Project',
          multipleCoordinates: {
            coordinateSystem: COORDINATE_SYSTEMS.OSGB36,
            coordinates: [
              { eastings: '425053', northings: '564180' },
              { eastings: '426053', northings: '565180' }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }

        mockDb.collection().findOne.mockResolvedValue(mockExemption)

        await getMultipleCoordinatesController.handler(
          { params: { exemptionId: mockExemptionId }, db: mockDb },
          mockHandler
        )

        expect(mockHandler.response).toHaveBeenCalledWith({
          message: 'success',
          value: {
            exemptionId: mockExemptionId,
            coordinateSystem: COORDINATE_SYSTEMS.OSGB36,
            coordinates: [
              { eastings: '425053', northings: '564180' },
              { eastings: '426053', northings: '565180' }
            ]
          }
        })
      })
    })

    describe('Error Scenarios', () => {
      it('should throw 404 when exemption does not exist', async () => {
        mockDb.collection().findOne.mockResolvedValue(null)

        await expect(
          getMultipleCoordinatesController.handler(
            { params: { exemptionId: mockExemptionId }, db: mockDb },
            mockHandler
          )
        ).rejects.toThrow(Boom.notFound('Exemption not found'))
      })

      it('should throw 500 when database error occurs', async () => {
        const mockError = new Error('Database connection failed')
        mockDb.collection().findOne.mockRejectedValue(mockError)

        await expect(
          getMultipleCoordinatesController.handler(
            { params: { exemptionId: mockExemptionId }, db: mockDb },
            mockHandler
          )
        ).rejects.toThrow(
          'Error retrieving multiple coordinates: Database connection failed'
        )
      })
    })
  })
})
