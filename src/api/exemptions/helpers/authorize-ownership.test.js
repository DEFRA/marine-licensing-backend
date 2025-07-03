import { authorizeOwnership } from './authorize-ownership.js'
import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { getContactId } from './get-contact-id.js'
import { config } from '../../../config.js'

jest.mock('./get-contact-id.js')
jest.mock('../../../config.js')

describe('authorizeOwnership', () => {
  let mockRequest
  let mockH
  let mockDb
  let mockCollection

  const mockgetContactId = jest.mocked(getContactId).mockReturnValue('user123')

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
      auth: { credentials: { contactId: 'user123' } }
    }

    config.get.mockReturnValue({
      authEnabled: true
    })
  })

  describe('when auth is disabled', () => {
    it('should continue without checking authorization when authEnabled is false', async () => {
      config.get.mockReturnValue({
        authEnabled: false
      })

      const result = await authorizeOwnership(mockRequest, mockH)

      expect(result).toBe('continue')
      expect(mockDb.collection).not.toHaveBeenCalled()
      expect(mockCollection.findOne).not.toHaveBeenCalled()
      expect(getContactId).not.toHaveBeenCalled()
    })
  })

  describe('when auth is enabled', () => {
    beforeEach(() => {
      config.get.mockReturnValue({
        authEnabled: true
      })
    })

    describe('when document exists and user is authorized', () => {
      it('should continue when user owns the document, for POST and patch', async () => {
        const document = {
          _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011'),
          contactId: 'user123',
          someData: 'test'
        }

        mockCollection.findOne.mockResolvedValue(document)

        const result = await authorizeOwnership(
          {
            params: {},
            payload: { id: '507f1f77bcf86cd799439011' },
            db: mockDb,
            auth: { credentials: { contactId: 'user123' } }
          },
          mockH
        )

        expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
        expect(mockCollection.findOne).toHaveBeenCalledWith({
          _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011')
        })
        expect(getContactId).toHaveBeenCalledWith(mockRequest.auth)
        expect(result).toBe('continue')
      })

      it('should continue when user owns the document, for GET route', async () => {
        const document = {
          _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011'),
          contactId: 'user123',
          someData: 'test'
        }

        mockCollection.findOne.mockResolvedValue(document)

        const result = await authorizeOwnership(mockRequest, mockH)

        expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
        expect(mockCollection.findOne).toHaveBeenCalledWith({
          _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011')
        })
        expect(getContactId).toHaveBeenCalledWith(mockRequest.auth)
        expect(result).toBe('continue')
      })
    })

    describe('when document does not exist', () => {
      it('should throw 404 when document is not found', async () => {
        mockCollection.findOne.mockResolvedValue(null)

        const boomSpy = jest.spyOn(Boom, 'notFound')

        await expect(authorizeOwnership(mockRequest, mockH)).rejects.toThrow()

        expect(boomSpy).toHaveBeenCalled()

        expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
        expect(mockCollection.findOne).toHaveBeenCalledWith({
          _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011')
        })
      })
    })

    describe('when user is not authorized', () => {
      it('should throw 404 when user does not own the document', async () => {
        const document = {
          _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011'),
          contactId: 'differentUser',
          someData: 'test'
        }

        mockCollection.findOne.mockResolvedValue(document)

        const boomSpy = jest.spyOn(Boom, 'notFound')

        await expect(authorizeOwnership(mockRequest, mockH)).rejects.toThrow()

        expect(boomSpy).toHaveBeenCalledWith(
          'Not authorized to update this resource'
        )

        expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
        expect(mockCollection.findOne).toHaveBeenCalledWith({
          _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011')
        })
        expect(mockgetContactId).toHaveBeenCalledWith(mockRequest.auth)
      })
    })
  })
})
