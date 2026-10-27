import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { updateConsultationRequestController } from './update-consultation-request.js'

describe('PATCH /marine-licence/update-consultation-request', () => {
  const relationshipId = randomUUID()

  const consulteeAuth = {
    credentials: { contactId: 'user123' },
    artifacts: {
      decoded: {
        relationships: [
          `${relationshipId}:${randomUUID()}:Consultee Org:0:Employee:0`
        ],
        roles: [`${relationshipId}:Consultee:3`],
        currentRelationshipId: relationshipId
      }
    }
  }

  test('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockError = 'Database failed'
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      updateConsultationRequestController.handler(
        {
          db: mockMongo,
          payload: {
            id: new ObjectId().toHexString(),
            response: 'We have no objections',
            updatedAt: new Date(),
            updatedBy: 'user123'
          },
          auth: consulteeAuth
        },
        mockHandler
      )
    ).rejects.toThrow(`Error updating consultation request: ${mockError}`)
  })
})
