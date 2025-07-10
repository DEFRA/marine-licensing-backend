import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { updateMultipleCoordinatesController } from './update-multiple-coordinates.js'

jest.mock('../helpers/authorize-ownership', () => ({
  authorizeOwnership: jest.fn((request, h) => {
    return Promise.resolve()
  })
}))

describe('updateMultipleCoordinatesController', () => {
  let mockRequest
  let mockH
  let mockDb
  let mockExemptionsCollection

  beforeEach(() => {
    mockExemptionsCollection = {
      findOne: jest.fn(),
      updateOne: jest.fn()
    }
    mockDb = {
      collection: jest.fn(() => mockExemptionsCollection)
    }

    mockRequest = {
      payload: {
        id: '60c7281f5f1b2c001c8e4d1a',
        coordinateSystem: 'WGS84',
        coordinates: [
          [10, 20],
          [30, 40]
        ]
      },
      db: mockDb
    }

    mockH = {
      response: jest.fn(() => mockH),
      code: jest.fn(() => mockH)
    }

    jest.clearAllMocks()
    jest.spyOn(Date, 'now').mockReturnValue(1678886400000)
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  describe('options', () => {
    it('should have a pre array with authorizeOwnership', () => {
      expect(updateMultipleCoordinatesController.options.pre).toEqual([
        { method: expect.any(Function) }
      ])
    })

    it('should have payload validation', () => {
      expect(
        updateMultipleCoordinatesController.options.validate.payload
      ).toBeDefined()
    })
  })

  describe('handler', () => {
    it('should successfully update multiple coordinates', async () => {
      mockExemptionsCollection.updateOne.mockResolvedValue({ matchedCount: 1 })

      const result = await updateMultipleCoordinatesController.handler(
        mockRequest,
        mockH
      )

      expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
      expect(mockExemptionsCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        {
          $set: {
            multipleCoordinates: {
              coordinateSystem: 'WGS84',
              coordinates: [
                [10, 20],
                [30, 40]
              ]
            }
          }
        }
      )
      expect(mockH.response).toHaveBeenCalledWith({
        message: 'success',
        value: {
          id: '60c7281f5f1b2c001c8e4d1a',
          coordinateSystem: 'WGS84',
          coordinates: 2
        }
      })
      expect(mockH.code).toHaveBeenCalledWith(StatusCodes.OK)
      expect(result).toBe(mockH)
    })

    it('should throw Boom.notFound if updateOne matchedCount is 0', async () => {
      mockExemptionsCollection.updateOne.mockResolvedValue({ matchedCount: 0 })

      await expect(
        updateMultipleCoordinatesController.handler(mockRequest, mockH)
      ).rejects.toThrow(Boom.notFound('Exemption not found'))

      expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
      expect(mockExemptionsCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        expect.any(Object)
      )
      expect(mockH.response).not.toHaveBeenCalled()
      expect(mockH.code).not.toHaveBeenCalled()
    })

    it('should throw Boom.internal for unexpected errors during updateOne', async () => {
      const mockError = new Error('Write operation failed')
      mockExemptionsCollection.updateOne.mockRejectedValue(mockError)

      await expect(
        updateMultipleCoordinatesController.handler(mockRequest, mockH)
      ).rejects.toThrow(
        Boom.internal(`Error saving multiple coordinates: ${mockError.message}`)
      )

      expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
      expect(mockExemptionsCollection.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(ObjectId) },
        expect.any(Object)
      )
      expect(mockH.response).not.toHaveBeenCalled()
      expect(mockH.code).not.toHaveBeenCalled()
    })

    it('should rethrow Boom errors directly', async () => {
      const boomError = Boom.badRequest('Invalid ID')
      const originalHandler = updateMultipleCoordinatesController.handler
      updateMultipleCoordinatesController.handler = jest.fn(() => {
        throw boomError
      })

      try {
        await updateMultipleCoordinatesController.handler(mockRequest, mockH)
      } catch (err) {
        expect(err).toBe(boomError)
        expect(err.message).toBe('Invalid ID')
      }

      updateMultipleCoordinatesController.handler = originalHandler
    })
  })
})
