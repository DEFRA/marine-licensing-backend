import { vi } from 'vitest'
import { sendWithholdingNotificationEmail } from './send-withholding-notification-email.js'
import { config } from '../../../../config.js'
import { sendEmail } from '../../../../shared/helpers/email.js'
import { mockMasWithholdingMessageBody } from './test-fixtures.js'

vi.mock('../../../../config.js')
vi.mock('../../../../shared/helpers/email.js', () => ({
  sendEmail: vi.fn()
}))

describe('sendWithholdingNotificationEmail', () => {
  let mockDb
  let mockCollection

  const { userName, userEmail, applicationReference } =
    mockMasWithholdingMessageBody
  const viewDetailsUrl =
    'http://localhost:3000/marine-licence/view-details/507f1f77bcf86cd799439011'

  const notifyWithholdingNotificationId = 'withholding-template-id'

  beforeEach(() => {
    mockCollection = {
      insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-id' })
    }
    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection)
    }

    config.get.mockImplementation((key) => {
      if (key === 'notify') {
        return {
          marineLicence: { notifyWithholdingNotificationId }
        }
      }
      return {}
    })
  })

  const send = (overrides = {}) =>
    sendWithholdingNotificationEmail({
      db: mockDb,
      userName,
      userEmail,
      applicationReference,
      viewDetailsUrl,
      ...overrides
    })

  it('should call sendEmail with the withholding template and personalisation', async () => {
    vi.mocked(sendEmail).mockResolvedValue({
      status: 'success',
      id: 'notify-id',
      reference: applicationReference
    })

    await send()

    expect(sendEmail).toHaveBeenCalledWith({
      templateId: notifyWithholdingNotificationId,
      userEmail,
      personalisation: {
        name: userName,
        applicationReference,
        viewDetailsUrl
      },
      applicationReference,
      projectType: 'marine-licence'
    })

    expect(mockDb.collection).toHaveBeenCalledWith('email-queue')
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

    await send({ userEmail: 'bad-email' })

    expect(mockCollection.insertOne).toHaveBeenCalledWith({
      applicationReferenceNumber: applicationReference,
      status: 'error',
      errors: '[{"error":"BadRequestError"}]',
      reference: applicationReference
    })
  })

  it('should surface a failed email-queue write rather than leaving it unhandled', async () => {
    vi.mocked(sendEmail).mockResolvedValue({ status: 'success' })
    mockCollection.insertOne.mockRejectedValue(new Error('mongo is down'))

    await expect(send()).rejects.toThrow('mongo is down')
  })
})
