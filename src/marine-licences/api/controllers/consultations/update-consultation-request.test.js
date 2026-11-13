import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { updateConsultationRequestController } from './update-consultation-request.js'
import {
  DYNAMICS_OUTBOUND_STATUS,
  MAS_CONSULTATION_STATUS
} from '../../../constants/marine-licence.js'
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

  test('should log when request to Dynamics fails', async () => {
    const { mockMongo, mockHandler } = global
    config.get.mockReturnValueOnce({ isDynamicsEnabled: true })
    addToDynamicsQueue.mockRejectedValueOnce(new Error('SQS unavailable'))
    const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return { findOne: vi.fn().mockResolvedValue(marineLicence), updateOne }
    })
    const logger = { error: vi.fn() }

    await updateConsultationRequestController.handler(
      { db: mockMongo, payload, auth, logger },
      mockHandler
    )

    const outboundField = `dynamicsOutbound.${DYNAMICS_REQUEST_ACTIONS.SEND_CONSULTATION_RESPONSE}:${organisationId}`
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ reference: 'MLA/2026/11883' })
      }),
      expect.stringContaining('marked failed')
    )
    expect(updateOne).toHaveBeenLastCalledWith(
      {
        applicationReference: 'MLA/2026/11883',
        [outboundField]: { $ne: DYNAMICS_OUTBOUND_STATUS.SENT }
      },
      { $set: { [outboundField]: DYNAMICS_OUTBOUND_STATUS.FAILED } }
    )
    expect(mockHandler.code).toHaveBeenCalledWith(200)
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

  test('should return 409 when the consultee responds between the read and the update', async () => {
    const { mockMongo, mockHandler } = global
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOne: vi.fn().mockResolvedValue(marineLicence),
        updateOne: vi.fn().mockResolvedValue({ matchedCount: 0 })
      }
    })

    await expect(
      updateConsultationRequestController.handler(
        { db: mockMongo, payload, auth },
        mockHandler
      )
    ).rejects.toMatchObject({
      output: { statusCode: 409 },
      message: `Consultation in Marine Licence ${id} has already been responded to`
    })
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
