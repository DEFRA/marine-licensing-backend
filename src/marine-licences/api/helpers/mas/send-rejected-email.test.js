import { vi } from 'vitest'
import { sendRejectedEmail } from './send-rejected-email.js'
import { config } from '../../../../config.js'
import { sendEmail } from '../../../../shared/helpers/email.js'
import { mockMasRejectedMessageBody } from './test-fixtures.js'

vi.mock('../../../../config.js')
vi.mock('../../../../shared/helpers/email.js', () => ({
  sendEmail: vi.fn()
}))

describe('sendRejectecEmail', () => {
  let mockDb
  let mockCollection

  const { userName, userEmail, applicationReference, viewDetailsUrl } =
    mockMasRejectedMessageBody

  const notifyRejectedId = 'rejected-template-id'

  beforeEach(() => {
    vi.clearAllMocks()

    mockCollection = {
      insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-id' })
    }
    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection)
    }

    config.get.mockImplementation((key) => {
      if (key === 'notify') {
        return {
          marineLicence: { notifyRejectedId }
        }
      }
      return {}
    })
  })

  it('should call sendEmail with the rejected template and personalisation', async () => {
    vi.mocked(sendEmail).mockResolvedValue({
      status: 'success',
      id: 'notify-id',
      reference: applicationReference
    })

    await sendRejectedEmail({
      db: mockDb,
      userName,
      userEmail,
      applicationReference,
      viewDetailsUrl
    })

    expect(sendEmail).toHaveBeenCalledWith({
      templateId: notifyRejectedId,
      userEmail,
      personalisation: {
        name: userName,
        applicationReference,
        viewDetailsUrl
      },
      applicationReference,
      projectType: 'marine-licence'
    })

    expect(mockCollection.insertOne).toHaveBeenCalledWith({
      applicationReferenceNumber: applicationReference,
      status: 'success',
      id: 'notify-id',
      reference: applicationReference
    })
  })

  it('should still write email-queue when sendEmail returns an error result', async () => {
    vi.mocked(sendEmail).mockResolvedValue({
      status: 'error',
      errors: '[{"error":"BadRequestError"}]',
      reference: applicationReference
    })

    await sendRejectedEmail({
      db: mockDb,
      userName,
      userEmail: 'bad-email',
      applicationReference,
      viewDetailsUrl
    })

    expect(mockCollection.insertOne).toHaveBeenCalledWith({
      applicationReferenceNumber: applicationReference,
      status: 'error',
      errors: '[{"error":"BadRequestError"}]',
      reference: applicationReference
    })
  })
})
