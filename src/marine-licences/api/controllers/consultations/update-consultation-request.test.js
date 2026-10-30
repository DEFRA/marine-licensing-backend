import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { updateConsultationRequestController } from './update-consultation-request.js'
import { MAS_CONSULTATION_STATUS } from '../../../constants/marine-licence.js'

describe('PATCH /marine-licence/update-consultation-request', () => {
  const relationshipId = randomUUID()
  const organisationId = randomUUID()
  const id = new ObjectId().toHexString()
  const payload = { id, response: 'We have no objections' }

  const auth = {
    credentials: { contactId: 'user123' },
    artifacts: {
      decoded: {
        relationships: [
          `${relationshipId}:${organisationId}:Consultee Org:0:Employee:0`
        ],
        roles: [`${relationshipId}:Consultee:3`],
        currentRelationshipId: relationshipId
      }
    }
  }

  test('should return a conflict if the consultee responds between the read and the update', async () => {
    const { mockMongo, mockHandler } = global
    const consultationStatus = MAS_CONSULTATION_STATUS.RESPONSE_NEEDED
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOne: vi.fn().mockResolvedValue({
          consultationRequests: [
            { consultees: [{ organisationId, consultationStatus }] }
          ]
        }),
        updateOne: vi.fn().mockResolvedValue({ matchedCount: 0 })
      }
    })

    await expect(
      updateConsultationRequestController.handler(
        { db: mockMongo, payload, auth },
        mockHandler
      )
    ).rejects.toThrow(
      `Consultation in Marine Licence ${id} does not need a response`
    )
  })

  test('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOne: vi.fn().mockRejectedValue(new Error('Database failed'))
      }
    })

    await expect(
      updateConsultationRequestController.handler(
        { db: mockMongo, payload, auth },
        mockHandler
      )
    ).rejects.toThrow('Error updating consultation request: Database failed')
  })
})
