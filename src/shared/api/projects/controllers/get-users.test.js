import { vi } from 'vitest'
import { getUsersController } from './get-users.js'
import { batchGetContactNames } from '../../../common/helpers/dynamics/get-contact-details.js'
import {
  collectionExemptions,
  collectionMarineLicences
} from '../../../common/constants/db-collections.js'
import { randomUUID } from 'node:crypto'
import Boom from '@hapi/boom'

vi.mock('../../../common/helpers/dynamics/get-contact-details.js', () => ({
  batchGetContactNames: vi.fn().mockResolvedValue({})
}))

describe('getUsersController', () => {
  let mockRequest
  let mockH
  let mockDb
  let mockExemptionCollection
  let mockMarineLicenceCollection
  const testContactId = 'contact-123-abc'
  const testOrgId = randomUUID()
  const inOrgContactId = randomUUID()
  const outOfOrgContactId = randomUUID()

  const createAuthWithOrg = (organisationId = testOrgId) => ({
    credentials: {
      contactId: testContactId
    },
    artifacts: {
      decoded: {
        currentRelationshipId: '81d48d6c-6e94-f011-b4cc-000d3ac28f39',
        relationships: [
          `81d48d6c-6e94-f011-b4cc-000d3ac28f39:${organisationId}:CDP Child Org 1:0:Employee:0`
        ]
      }
    }
  })

  const createAuthWithoutOrg = () => ({
    credentials: {
      contactId: testContactId
    },
    artifacts: {
      decoded: {
        relationships: []
      }
    }
  })

  beforeEach(() => {
    mockExemptionCollection = { distinct: vi.fn().mockResolvedValue([]) }
    mockMarineLicenceCollection = { distinct: vi.fn().mockResolvedValue([]) }

    mockDb = {
      collection: vi.fn((name) => {
        if (name === collectionExemptions) return mockExemptionCollection
        if (name === collectionMarineLicences) {
          return mockMarineLicenceCollection
        }
        return { distinct: vi.fn().mockResolvedValue([]) }
      })
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    }

    mockRequest = {
      db: mockDb,
      auth: createAuthWithOrg(),
      payload: { contactIds: [inOrgContactId] }
    }
  })

  describe('payload validation', () => {
    const payloadValidator = getUsersController.options.validate.payload

    test('should require contactIds', () => {
      const result = payloadValidator.validate({})

      expect(result.error).toBeDefined()
    })

    test('should accept a valid contactIds array', () => {
      const result = payloadValidator.validate({
        contactIds: [inOrgContactId]
      })

      expect(result.error).toBeUndefined()
    })
  })

  describe('handler', () => {
    test('should resolve only ids that belong to the caller organisation', async () => {
      mockExemptionCollection.distinct.mockResolvedValue([inOrgContactId])
      mockRequest.payload = { contactIds: [inOrgContactId, outOfOrgContactId] }
      batchGetContactNames.mockResolvedValue({
        [inOrgContactId]: 'Jane Smith'
      })

      await getUsersController.handler(mockRequest, mockH)

      expect(batchGetContactNames).toHaveBeenCalledWith([inOrgContactId])
      expect(mockH.response).toHaveBeenCalledWith({
        message: 'success',
        value: { [inOrgContactId]: 'Jane Smith' }
      })
    })

    test('should not call batchGetContactNames when no requested id belongs to the organisation', async () => {
      mockExemptionCollection.distinct.mockResolvedValue([])
      mockRequest.payload = { contactIds: [outOfOrgContactId] }

      await getUsersController.handler(mockRequest, mockH)

      expect(batchGetContactNames).toHaveBeenCalledWith([])
    })

    test('should return an empty map without querying anything when the caller is not an employee', async () => {
      mockRequest.auth = createAuthWithoutOrg()

      expect(getUsersController.handler(mockRequest, mockH)).rejects.toThrow(
        Boom.forbidden(`Not authorised to get user names for this organisation`)
      )

      expect(mockExemptionCollection.distinct).not.toHaveBeenCalled()
      expect(mockMarineLicenceCollection.distinct).not.toHaveBeenCalled()
      expect(batchGetContactNames).not.toHaveBeenCalled()
    })

    test('should throw error when user is not authenticated', async () => {
      mockRequest.auth = {
        credentials: {},
        artifacts: {
          decoded: {
            relationships: []
          }
        }
      }

      await expect(
        getUsersController.handler(mockRequest, mockH)
      ).rejects.toThrow('User not authenticated')
    })
  })
})
