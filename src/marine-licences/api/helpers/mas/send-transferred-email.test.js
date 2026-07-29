import { vi } from 'vitest'
import { sendTransferredEmail } from './send-transferred-email.js'
import { config } from '../../../../config.js'
import { sendEmail } from '../../../../shared/helpers/email.js'
import { mockMasTransferredMessageBody } from './test-fixtures.js'

vi.mock('../../../../config.js')
vi.mock('../../../../shared/helpers/email.js', () => ({
  sendEmail: vi.fn()
}))

describe('sendTransferredEmail', () => {
  let mockDb
  let mockCollection

  const { userName, userEmail, applicationReference, viewDetailsUrl } =
    mockMasTransferredMessageBody

  const notifyTransferredId = 'transferred-template-id'

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
          marineLicence: { notifyTransferredId }
        }
      }
      return {}
    })
  })

  it('should call sendEmail with the transferred template and personalisation', async () => {
    vi.mocked(sendEmail).mockResolvedValue({
      status: 'success',
      id: 'notify-id',
      reference: applicationReference
    })

    await sendTransferredEmail({
      db: mockDb,
      userName,
      userEmail,
      applicationReference,
      viewDetailsUrl
    })

    expect(sendEmail).toHaveBeenCalledWith({
      templateId: notifyTransferredId,
      userEmail,
      personalisation: {
        name: userName,
        applicationReference,
        viewDetailsUrl
      },
      reference: applicationReference,
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

    await sendTransferredEmail({
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
