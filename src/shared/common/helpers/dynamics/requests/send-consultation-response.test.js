import { vi } from 'vitest'
import Wreck from '@hapi/wreck'
import { config } from '../../../../../config.js'
import { sendConsultationResponseToDynamics } from './send-consultation-response.js'
import { mockMasConsultationResponseQueueItem } from '../../../../../marine-licences/api/helpers/mas/test-fixtures.js'

vi.mock('@hapi/wreck')
vi.mock('../../../../../config.js')
vi.mock('../../logging/logger.js', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn() }))
}))

describe('sendConsultationResponseToDynamics', () => {
  const mockAccessToken = 'test-access-token'
  const mockWreckPost = vi.mocked(Wreck.post)

  beforeEach(() => {
    config.get.mockReturnValue({
      marineLicences: {
        updateUrl: 'https://localhost/marine-licences/update',
        httpTimeoutMs: 120_000
      }
    })
    mockWreckPost.mockResolvedValue({
      payload: { id: 'dynamics-record-id' },
      res: { statusCode: 202 }
    })
  })

  test('should send the consultation response to the marine licence update endpoint', async () => {
    const result = await sendConsultationResponseToDynamics(
      {},
      mockAccessToken,
      mockMasConsultationResponseQueueItem
    )

    expect(result).toEqual({ id: 'dynamics-record-id' })
    expect(mockWreckPost).toHaveBeenCalledWith(
      'https://localhost/marine-licences/update',
      {
        payload: mockMasConsultationResponseQueueItem,
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
      sendConsultationResponseToDynamics(
        {},
        mockAccessToken,
        mockMasConsultationResponseQueueItem
      )
    ).rejects.toThrow('Dynamics API returned status 400')
  })
})
