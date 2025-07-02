import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import {
  getMultipleCoordinatesController,
  postMultipleCoordinatesController
} from './multiple-coordinates.js'
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

  describe('POST Multiple Coordinates Controller', () => {
    describe('Success Scenarios', () => {
      it('should save new WGS84 coordinates successfully', async () => {
        const mockExemption = {
          _id: ObjectId.createFromHexString(mockExemptionId),
          projectName: 'Test Project'
          // No existing multipleCoordinates
        }

        const payload = {
          id: mockExemptionId,
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: [
            { latitude: '55.123456', longitude: '-1.234567' },
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        mockDb.collection().findOne.mockResolvedValue(mockExemption)
        mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 1 })

        await postMultipleCoordinatesController.handler(
          {
            params: { exemptionId: mockExemptionId },
            payload,
            db: mockDb
          },
          mockHandler
        )

        expect(mockHandler.response).toHaveBeenCalledWith({
          message: 'success',
          value: {
            exemptionId: mockExemptionId,
            coordinateSystem: COORDINATE_SYSTEMS.WGS84,
            coordinates: 3
          }
        })
        expect(mockHandler.code).toHaveBeenCalledWith(201)
      })

      it('should save new OSGB36 coordinates successfully', async () => {
        const mockExemption = {
          _id: ObjectId.createFromHexString(mockExemptionId),
          projectName: 'Test Project'
        }

        const payload = {
          id: mockExemptionId,
          coordinateSystem: COORDINATE_SYSTEMS.OSGB36,
          coordinates: [
            { eastings: '425053', northings: '564180' },
            { eastings: '426053', northings: '565180' },
            { eastings: '427053', northings: '566180' }
          ]
        }

        mockDb.collection().findOne.mockResolvedValue(mockExemption)
        mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 1 })

        await postMultipleCoordinatesController.handler(
          {
            params: { exemptionId: mockExemptionId },
            payload,
            db: mockDb
          },
          mockHandler
        )

        expect(mockHandler.response).toHaveBeenCalledWith({
          message: 'success',
          value: {
            exemptionId: mockExemptionId,
            coordinateSystem: COORDINATE_SYSTEMS.OSGB36,
            coordinates: 3
          }
        })
        expect(mockHandler.code).toHaveBeenCalledWith(201)
      })

      it('should replace existing coordinates with same coordinate system', async () => {
        const existingCreatedAt = new Date('2025-01-01')
        const mockExemption = {
          _id: ObjectId.createFromHexString(mockExemptionId),
          projectName: 'Test Project',
          multipleCoordinates: {
            coordinateSystem: COORDINATE_SYSTEMS.WGS84,
            coordinates: [{ latitude: '50.000000', longitude: '-2.000000' }],
            createdAt: existingCreatedAt,
            updatedAt: new Date('2025-01-02')
          }
        }

        const payload = {
          id: mockExemptionId,
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: [
            { latitude: '55.123456', longitude: '-1.234567' },
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        mockDb.collection().findOne.mockResolvedValue(mockExemption)
        mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 1 })

        await postMultipleCoordinatesController.handler(
          {
            params: { exemptionId: mockExemptionId },
            payload,
            db: mockDb
          },
          mockHandler
        )

        expect(mockDb.collection().updateOne).toHaveBeenCalledWith(
          { _id: ObjectId.createFromHexString(mockExemptionId) },
          {
            $set: {
              multipleCoordinates: {
                coordinateSystem: COORDINATE_SYSTEMS.WGS84,
                coordinates: payload.coordinates,
                createdAt: existingCreatedAt, // Should preserve original createdAt
                updatedAt: expect.any(Date)
              }
            }
          }
        )

        expect(mockHandler.response).toHaveBeenCalledWith({
          message: 'success',
          value: {
            exemptionId: mockExemptionId,
            coordinateSystem: COORDINATE_SYSTEMS.WGS84,
            coordinates: 3
          }
        })
      })

      it('should call updateOne with correctly formatted coordinate data', async () => {
        const mockExemption = {
          _id: ObjectId.createFromHexString(mockExemptionId),
          projectName: 'Test Project'
        }

        const payload = {
          id: mockExemptionId,
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: [
            { latitude: '55.123456', longitude: '-1.234567' },
            { latitude: '55.234567', longitude: '-1.345678' }
          ]
        }

        mockDb.collection().findOne.mockResolvedValue(mockExemption)
        mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 1 })

        await postMultipleCoordinatesController.handler(
          {
            params: { exemptionId: mockExemptionId },
            payload,
            db: mockDb
          },
          mockHandler
        )

        expect(mockDb.collection().updateOne).toHaveBeenCalledWith(
          { _id: ObjectId.createFromHexString(mockExemptionId) },
          {
            $set: {
              multipleCoordinates: {
                coordinateSystem: COORDINATE_SYSTEMS.WGS84,
                coordinates: payload.coordinates,
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date)
              }
            }
          }
        )
      })
    })

    describe('Error Scenarios', () => {
      it('should throw 400 when exemption ID mismatch between URL and payload', async () => {
        const differentExemptionId = new ObjectId().toHexString()
        const payload = {
          id: differentExemptionId,
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: [
            { latitude: '55.123456', longitude: '-1.234567' },
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        await expect(
          postMultipleCoordinatesController.handler(
            {
              params: { exemptionId: mockExemptionId },
              payload,
              db: mockDb
            },
            mockHandler
          )
        ).rejects.toThrow(
          Boom.badRequest('Exemption ID mismatch between URL and payload')
        )
      })

      it('should throw 404 when exemption does not exist', async () => {
        const payload = {
          id: mockExemptionId,
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: [
            { latitude: '55.123456', longitude: '-1.234567' },
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        mockDb.collection().findOne.mockResolvedValue(null)

        await expect(
          postMultipleCoordinatesController.handler(
            {
              params: { exemptionId: mockExemptionId },
              payload,
              db: mockDb
            },
            mockHandler
          )
        ).rejects.toThrow(Boom.notFound('Exemption not found'))
      })

      it('should throw 409 when coordinate system mismatch with existing coordinates', async () => {
        const mockExemption = {
          _id: ObjectId.createFromHexString(mockExemptionId),
          projectName: 'Test Project',
          multipleCoordinates: {
            coordinateSystem: COORDINATE_SYSTEMS.OSGB36,
            coordinates: [{ eastings: '425053', northings: '564180' }]
          }
        }

        const payload = {
          id: mockExemptionId,
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: [
            { latitude: '55.123456', longitude: '-1.234567' },
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        mockDb.collection().findOne.mockResolvedValue(mockExemption)

        await expect(
          postMultipleCoordinatesController.handler(
            {
              params: { exemptionId: mockExemptionId },
              payload,
              db: mockDb
            },
            mockHandler
          )
        ).rejects.toThrow(
          Boom.conflict(
            `Coordinate system mismatch. Existing coordinates use ${COORDINATE_SYSTEMS.OSGB36}, but received ${COORDINATE_SYSTEMS.WGS84}`
          )
        )
      })

      it('should throw 404 when exemption is not found during update', async () => {
        const mockExemption = {
          _id: ObjectId.createFromHexString(mockExemptionId),
          projectName: 'Test Project'
        }

        const payload = {
          id: mockExemptionId,
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: [
            { latitude: '55.123456', longitude: '-1.234567' },
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        mockDb.collection().findOne.mockResolvedValue(mockExemption)
        mockDb.collection().updateOne.mockResolvedValue({ matchedCount: 0 })

        await expect(
          postMultipleCoordinatesController.handler(
            {
              params: { exemptionId: mockExemptionId },
              payload,
              db: mockDb
            },
            mockHandler
          )
        ).rejects.toThrow(Boom.notFound('Exemption not found'))
      })

      it('should throw 500 when database error occurs', async () => {
        const payload = {
          id: mockExemptionId,
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: [
            { latitude: '55.123456', longitude: '-1.234567' },
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        const mockError = new Error('Database connection failed')
        mockDb.collection().findOne.mockRejectedValue(mockError)

        await expect(
          postMultipleCoordinatesController.handler(
            {
              params: { exemptionId: mockExemptionId },
              payload,
              db: mockDb
            },
            mockHandler
          )
        ).rejects.toThrow(
          'Error saving multiple coordinates: Database connection failed'
        )
      })
    })
  })
})
