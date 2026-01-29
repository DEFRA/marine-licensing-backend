import { vi } from 'vitest'
import { authorizeOwnership } from './authorize-ownership.js'
import { collectionExemptions } from '../../common/constants/db-collections.js'
import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'

vi.mock('../../../plugins/auth.js')

describe('authorizeOwnership', () => {
  let mockRequest
  let mockH
  let mockDb
  let mockCollection

  beforeEach(() => {
    mockCollection = {
      findOne: vi.fn()
    }

    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection)
    }

    mockH = {
      continue: 'continue'
    }

    mockRequest = {
      params: { id: '507f1f77bcf86cd799439011' },
      db: mockDb,
      auth: { credentials: { contactId: 'user123' } }
    }
  })

  describe('exemptions collection', () => {
    describe('when document exists and user is authorized', () => {
      it('should continue when user owns the document, for POST and patch', async () => {
        const document = {
          _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011'),
          contactId: 'user123',
          someData: 'test'
        }

        mockCollection.findOne.mockResolvedValue(document)

        const handler = authorizeOwnership(collectionExemptions)

        const result = await handler(
          {
            params: {},
            payload: { id: '507f1f77bcf86cd799439011' },
            db: mockDb,
            auth: { credentials: { contactId: 'user123' } }
          },
          mockH
        )

        expect(mockDb.collection).toHaveBeenCalledWith(collectionExemptions)
        expect(mockCollection.findOne).toHaveBeenCalledWith({
          _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011')
        })
        expect(result).toBe('continue')
      })

      it('should continue when user owns the document, for GET route', async () => {
        const document = {
          _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011'),
          contactId: 'user123',
          someData: 'test'
        }

        mockCollection.findOne.mockResolvedValue(document)

        const handler = authorizeOwnership(collectionExemptions)
        const result = await handler(mockRequest, mockH)

        expect(mockDb.collection).toHaveBeenCalledWith(collectionExemptions)
        expect(mockCollection.findOne).toHaveBeenCalledWith({
          _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011')
        })
        expect(result).toBe('continue')
      })
    })

    describe('when document does not exist', () => {
      it('should throw 404 when document is not found', async () => {
        mockCollection.findOne.mockResolvedValue(null)

        const boomSpy = vi.spyOn(Boom, 'notFound')

        const handler = authorizeOwnership(collectionExemptions)
        await expect(handler(mockRequest, mockH)).rejects.toThrow()

        expect(boomSpy).toHaveBeenCalled()

        expect(mockDb.collection).toHaveBeenCalledWith(collectionExemptions)
        expect(mockCollection.findOne).toHaveBeenCalledWith({
          _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011')
        })
      })
    })

    describe('when user is not authorized', () => {
      it('should throw 403 when user does not own the document', async () => {
        const document = {
          _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011'),
          contactId: 'differentUser',
          someData: 'test'
        }

        mockCollection.findOne.mockResolvedValue(document)

        const handler = authorizeOwnership(collectionExemptions)
        await expect(handler(mockRequest, mockH)).rejects.toThrow(
          'Not authorized to request this resource'
        )

        expect(mockDb.collection).toHaveBeenCalledWith(collectionExemptions)
        expect(mockCollection.findOne).toHaveBeenCalledWith({
          _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011')
        })
      })
    })
  })

  describe('configurable collection', () => {
    it('should use the specified collection name', async () => {
      const document = {
        _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011'),
        contactId: 'user123',
        someData: 'test'
      }

      mockCollection.findOne.mockResolvedValue(document)

      const handler = authorizeOwnership('marine-licenses')
      const result = await handler(mockRequest, mockH)

      expect(mockDb.collection).toHaveBeenCalledWith('marine-licenses')
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011')
      })
      expect(result).toBe('continue')
    })

    it('should throw 404 when document not found in specified collection', async () => {
      mockCollection.findOne.mockResolvedValue(null)

      const boomSpy = vi.spyOn(Boom, 'notFound')

      const handler = authorizeOwnership('marine-licenses')
      await expect(handler(mockRequest, mockH)).rejects.toThrow()

      expect(boomSpy).toHaveBeenCalled()
      expect(mockDb.collection).toHaveBeenCalledWith('marine-licenses')
    })

    it('should throw 403 when user does not own document in specified collection', async () => {
      const document = {
        _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011'),
        contactId: 'differentUser',
        someData: 'test'
      }

      mockCollection.findOne.mockResolvedValue(document)

      const handler = authorizeOwnership('marine-licenses')
      await expect(handler(mockRequest, mockH)).rejects.toThrow(
        'Not authorized to request this resource'
      )

      expect(mockDb.collection).toHaveBeenCalledWith('marine-licenses')
    })
  })
})
