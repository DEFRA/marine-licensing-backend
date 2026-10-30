import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { updateConsultationRequestController } from './update-consultation-request.js'
import { MAS_CONSULTATION_STATUS } from '../../../constants/marine-licence.js'
import { config } from '../../../../config.js'
import { addToDynamicsQueue } from '../../../../shared/common/helpers/dynamics/index.js'
import {
  DYNAMICS_QUEUE_TYPES,
  DYNAMICS_REQUEST_ACTIONS
} from '../../../../shared/common/constants/request-queue.js'

vi.mock('../../../../config.js', () => ({
  config: { get: vi.fn(() => ({ isDynamicsEnabled: false })) }
}))
vi.mock('../../../../shared/common/helpers/dynamics/index.js')

describe('PATCH /marine-licence/update-consultation-request', () => {
  const relationshipId = randomUUID()
  const organisationId = randomUUID()
  const id = new ObjectId().toHexString()
  const response = 'We have no objections'
  const payload = { id, response }

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

  const marineLicence = {
    applicationReference: 'MLA/2026/11883',
    consultationRequests: [
      {
        consultees: [
          {
            organisationId,
            consultationStatus: MAS_CONSULTATION_STATUS.RESPONSE_NEEDED
          }
        ]
      }
    ]
  }

  test('should queue the consultation response for Dynamics when the integration is enabled', async () => {
    const { mockMongo, mockHandler } = global
    config.get.mockReturnValueOnce({ isDynamicsEnabled: true })
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOne: vi.fn().mockResolvedValue(marineLicence),
        updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 })
      }
    })
    const request = { db: mockMongo, payload, auth }

    await updateConsultationRequestController.handler(request, mockHandler)

    expect(addToDynamicsQueue).toHaveBeenCalledWith({
      request,
      applicationReference: 'MLA/2026/11883',
      action: DYNAMICS_REQUEST_ACTIONS.SEND_CONSULTATION_RESPONSE,
      type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE,
      response,
      organisationId
    })
  })

  test('should not queue the consultation response for Dynamics when the integration is disabled', async () => {
    const { mockMongo, mockHandler } = global
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOne: vi.fn().mockResolvedValue(marineLicence),
        updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 })
      }
    })

    await updateConsultationRequestController.handler(
      { db: mockMongo, payload, auth },
      mockHandler
    )

    expect(addToDynamicsQueue).not.toHaveBeenCalled()
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
