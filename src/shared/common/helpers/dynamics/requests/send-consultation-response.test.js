import { vi } from 'vitest'
import Wreck from '@hapi/wreck'
import { config } from '../../../../../config.js'
import { sendConsultationResponseToDynamics } from './send-consultation-response.js'
import {
  DYNAMICS_QUEUE_TYPES,
  DYNAMICS_REQUEST_ACTIONS
} from '../../../constants/request-queue.js'

vi.mock('@hapi/wreck')
vi.mock('../../../../../config.js')
vi.mock('../../logging/logger.js', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn() }))
}))

describe('sendConsultationResponseToDynamics', () => {
  const mockQueueItem = {
    applicationReferenceNumber: 'MLA/2026/00001',
    action: DYNAMICS_REQUEST_ACTIONS.SEND_CONSULTATION_RESPONSE,
    type: DYNAMICS_QUEUE_TYPES.MARINE_LICENCE,
    organisationId: 'test-org-id',
    response: 'No objection'
  }

  const mockAccessToken = 'test-access-token'
  const mockWreckPost = vi.mocked(Wreck.post)

  beforeEach(() => {
    config.get.mockReturnValue({
      marineLicences: {
        apiUrl: 'https://localhost/api/data/v9.2/marine-licences',
        httpTimeoutMs: 120_000
      }
    })
    mockWreckPost.mockResolvedValue({
      payload: { id: 'dynamics-record-id' },
      res: { statusCode: 202 }
    })
  })

  test('should send the consultation response to the marine licence endpoint', async () => {
    const result = await sendConsultationResponseToDynamics(
      {},
      mockAccessToken,
      mockQueueItem
    )

    expect(result).toEqual({ id: 'dynamics-record-id' })
    expect(mockWreckPost).toHaveBeenCalledWith(
      'https://localhost/api/data/v9.2/marine-licences',
      {
        payload: {
          action: DYNAMICS_REQUEST_ACTIONS.SEND_CONSULTATION_RESPONSE,
          reference: 'MLA/2026/00001',
          organisationId: 'test-org-id',
          response: 'No objection'
        },
        headers: {
          Authorization: 'Bearer test-access-token',
          'Content-Type': 'application/json'
        },
        timeout: 120_000
      }
    )
  })

  test('should throw error if response status is not 202', async () => {
    mockWreckPost.mockResolvedValue({
      payload: { error: 'Bad Request' },
      res: { statusCode: 400 }
    })

    await expect(
      sendConsultationResponseToDynamics({}, mockAccessToken, mockQueueItem)
    ).rejects.toThrow('Dynamics API returned status 400')
  })
})
