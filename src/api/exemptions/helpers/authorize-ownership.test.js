import { authorizeOwnership } from './authorize-ownership.js'
import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { getUserId } from './get-user-id.js'

jest.mock('./get-user-id.js')

describe('authorizeOwnership', () => {
  let mockRequest
  let mockH
  let mockDb
  let mockCollection

  const mockGetUserId = jest.mocked(getUserId).mockReturnValue('user123')

  beforeEach(() => {
    jest.clearAllMocks()

    mockCollection = {
      findOne: jest.fn()
    }

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection)
    }

    mockH = {
      continue: 'continue'
    }

    mockRequest = {
      params: { id: '507f1f77bcf86cd799439011' },
      db: mockDb,
      auth: { credentials: { userId: 'user123' } }
    }
  })

  describe('when document exists and user is authorized', () => {
    it('should continue when user owns the document, for POST and patch', async () => {
      const document = {
        _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011'),
        userId: 'user123',
        someData: 'test'
      }

      mockCollection.findOne.mockResolvedValue(document)

      const result = await authorizeOwnership(
        {
          params: {},
          payload: { id: '507f1f77bcf86cd799439011' },
          db: mockDb,
          auth: { credentials: { userId: 'user123' } }
        },
        mockH
      )

      expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011')
      })
      expect(getUserId).toHaveBeenCalledWith(mockRequest.auth)
      expect(result).toBe('continue')
    })

    it('should continue when user owns the document, for GET route', async () => {
      const document = {
        _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011'),
        userId: 'user123',
        someData: 'test'
      }

      mockCollection.findOne.mockResolvedValue(document)

      const result = await authorizeOwnership(mockRequest, mockH)

      expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011')
      })
      expect(getUserId).toHaveBeenCalledWith(mockRequest.auth)
      expect(result).toBe('continue')
    })
  })

  describe('when document does not exist', () => {
    it('should throw 404 when document is not found', async () => {
      mockCollection.findOne.mockResolvedValue(null)

      await expect(authorizeOwnership(mockRequest, mockH)).rejects.toThrow(
        Boom.notFound()
      )

      expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011')
      })
    })
  })

  describe('when user is not authorized', () => {
    it('should throw 403 when user does not own the document', async () => {
      const document = {
        _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011'),
        userId: 'differentUser',
        someData: 'test'
      }

      mockCollection.findOne.mockResolvedValue(document)

      await expect(authorizeOwnership(mockRequest, mockH)).rejects.toThrow(
        Boom.forbidden('Not authorized to update this resource')
      )

      expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011')
      })
      expect(mockGetUserId).toHaveBeenCalledWith(mockRequest.auth)
    })
  })
})
