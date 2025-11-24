import { vi } from 'vitest'
import {
  authorizeOwnership,
  errorIfUserNotAuthorizedToViewExemption
} from './authorize-ownership.js'
import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { getContactId } from './get-contact-id.js'
import { getJwtAuthStrategy } from '../../../plugins/auth.js'

vi.mock('./get-contact-id.js')
vi.mock('../../../plugins/auth.js')

describe('authorizeOwnership', () => {
  let mockRequest
  let mockH
  let mockDb
  let mockCollection

  const mockgetContactId = vi.mocked(getContactId).mockReturnValue('user123')

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

      const boomSpy = vi.spyOn(Boom, 'notFound')

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

      const boomSpy = vi.spyOn(Boom, 'notFound')

      await expect(authorizeOwnership(mockRequest, mockH)).rejects.toThrow()

      expect(boomSpy).toHaveBeenCalledWith(
        'Not authorized to request this resource'
      )

      expect(mockDb.collection).toHaveBeenCalledWith('exemptions')
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        _id: ObjectId.createFromHexString('507f1f77bcf86cd799439011')
      })
      expect(mockgetContactId).toHaveBeenCalledWith(mockRequest.auth)
    })
  })
})

describe('errorIfUserNotAuthorizedToViewExemption', () => {
  const mockGetJwtAuthStrategy = vi.mocked(getJwtAuthStrategy)
  const mockGetContactId = vi.mocked(getContactId)

  describe('when auth strategy is defraId', () => {
    beforeEach(() => {
      mockGetJwtAuthStrategy.mockReturnValue('defraId')
    })

    it('should not throw when user owns the exemption', async () => {
      mockGetContactId.mockReturnValue('user123')

      const request = {
        auth: {
          artifacts: { decoded: { some: 'token' } },
          credentials: { contactId: 'user123' }
        }
      }
      const exemption = { contactId: 'user123' }

      await expect(
        errorIfUserNotAuthorizedToViewExemption({ request, exemption })
      ).resolves.not.toThrow()

      expect(mockGetJwtAuthStrategy).toHaveBeenCalledWith(
        request.auth.artifacts.decoded
      )
      expect(mockGetContactId).toHaveBeenCalledWith(request.auth)
    })

    it('should throw 403 when user does not own the exemption', async () => {
      mockGetContactId.mockReturnValue('user123')

      const request = {
        auth: {
          artifacts: { decoded: { some: 'token' } },
          credentials: { contactId: 'user123' }
        }
      }
      const exemption = { contactId: 'differentUser' }

      const boomSpy = vi.spyOn(Boom, 'forbidden')

      await expect(
        errorIfUserNotAuthorizedToViewExemption({ request, exemption })
      ).rejects.toThrow()

      expect(boomSpy).toHaveBeenCalledWith(
        'Not authorized to request this resource'
      )
    })
  })

  describe('when auth strategy is not defraId', () => {
    it('should not throw regardless of ownership', async () => {
      mockGetJwtAuthStrategy.mockReturnValue('entraId')

      const request = {
        auth: {
          artifacts: { decoded: { some: 'token' } }
        }
      }
      const exemption = { contactId: 'anyUser' }

      await expect(
        errorIfUserNotAuthorizedToViewExemption({ request, exemption })
      ).resolves.not.toThrow()

      expect(mockGetJwtAuthStrategy).toHaveBeenCalledWith(
        request.auth.artifacts.decoded
      )
      expect(mockGetContactId).not.toHaveBeenCalled()
    })
  })

  describe('when auth artifacts are missing', () => {
    it('should handle missing auth artifacts gracefully', async () => {
      mockGetJwtAuthStrategy.mockReturnValue(null)

      const request = {
        auth: {}
      }
      const exemption = { contactId: 'anyUser' }

      await expect(
        errorIfUserNotAuthorizedToViewExemption({ request, exemption })
      ).resolves.not.toThrow()

      expect(mockGetJwtAuthStrategy).toHaveBeenCalledWith(undefined)
    })
  })
})
