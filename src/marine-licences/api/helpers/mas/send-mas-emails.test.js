import { vi } from 'vitest'
import { config } from '../../../../config.js'
import { sendEmail } from '../../../../shared/helpers/email.js'
import { sendRejectedEmail } from './send-rejected-email.js'
import { sendTransferredEmail } from './send-transferred-email.js'
import { sendWithholdingNotificationEmail } from './send-withholding-notification-email.js'
import {
  mockMasApplicationReference,
  mockMasUserEmail,
  mockMasUserName
} from './test-fixtures.js'

vi.mock('../../../../config.js')
vi.mock('../../../../shared/helpers/email.js', () => ({
  sendEmail: vi.fn()
}))

const viewDetailsUrl =
  'http://localhost:3000/marine-licence/view-details/507f1f77bcf86cd799439011'

const templateIds = {
  notifyRejectedId: 'rejected-template-id',
  notifyTransferredId: 'transferred-template-id',
  notifyWithholdingNotificationId: 'withholding-template-id'
}

const senders = [
  ['sendRejectedEmail', sendRejectedEmail, 'notifyRejectedId'],
  ['sendTransferredEmail', sendTransferredEmail, 'notifyTransferredId'],
  [
    'sendWithholdingNotificationEmail',
    sendWithholdingNotificationEmail,
    'notifyWithholdingNotificationId'
  ]
]

describe('MAS notification emails', () => {
  let mockDb
  let mockCollection

  beforeEach(() => {
    mockCollection = {
      insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-id' })
    }
    mockDb = { collection: vi.fn().mockReturnValue(mockCollection) }

    config.get.mockImplementation((key) =>
      key === 'notify' ? { marineLicence: templateIds } : {}
    )
  })

  const send = (sender, overrides = {}) =>
    sender({
      db: mockDb,
      userName: mockMasUserName,
      userEmail: mockMasUserEmail,
      applicationReference: mockMasApplicationReference,
      viewDetailsUrl,
      ...overrides
    })

  describe.each(senders)('%s', (_name, sender, templateIdKey) => {
    it('sends with its own template and the three personalisation keys', async () => {
      vi.mocked(sendEmail).mockResolvedValue({
        status: 'success',
        id: 'notify-id',
        reference: mockMasApplicationReference
      })

      await send(sender)

      expect(sendEmail).toHaveBeenCalledWith({
        templateId: templateIds[templateIdKey],
        userEmail: mockMasUserEmail,
        personalisation: {
          name: mockMasUserName,
          applicationReference: mockMasApplicationReference,
          viewDetailsUrl
        },
        applicationReference: mockMasApplicationReference,
        projectType: 'marine-licence'
      })

      expect(mockDb.collection).toHaveBeenCalledWith('email-queue')
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        applicationReferenceNumber: mockMasApplicationReference,
        status: 'success',
        id: 'notify-id',
        reference: mockMasApplicationReference
      })
    })

    it('records an error result on the queue rather than throwing', async () => {
      vi.mocked(sendEmail).mockResolvedValue({
        status: 'error',
        errors: '[{"error":"BadRequestError"}]',
        reference: mockMasApplicationReference
      })

      await send(sender, { userEmail: 'bad-email' })

      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        applicationReferenceNumber: mockMasApplicationReference,
        status: 'error',
        errors: '[{"error":"BadRequestError"}]',
        reference: mockMasApplicationReference
      })
    })
  })

  // Only this sender awaits the queue write; its two siblings still fire and
  // forget, so a failed insert there surfaces as an unhandled rejection.
  it('surfaces a failed queue write for the withholding notification', async () => {
    vi.mocked(sendEmail).mockResolvedValue({ status: 'success' })
    mockCollection.insertOne.mockRejectedValue(new Error('mongo is down'))

    await expect(send(sendWithholdingNotificationEmail)).rejects.toThrow(
      'mongo is down'
    )
  })
})
