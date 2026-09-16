import { vi } from 'vitest'
import { updateWithholdingNotification } from './update-withholding-notification.js'
import { addApplicationTask } from './add-application-task.js'
import { sendWithholdingNotificationEmail } from './send-withholding-notification-email.js'
import { APPLICATION_TASK_TYPE } from '../../../constants/marine-licence.js'
import {
  mockMasWithholdingMessageBody,
  mockMasWithholdingNationalSecurityOnlyMessageBody,
  mockMasWithholdingCommercialOnlyMessageBody
} from './test-fixtures.js'

vi.mock('./add-application-task.js', () => ({
  addApplicationTask: vi.fn()
}))
vi.mock('./send-withholding-notification-email.js', () => ({
  sendWithholdingNotificationEmail: vi.fn()
}))

describe('updateWithholdingNotification', () => {
  const db = { collection: vi.fn() }
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const messageId = 'message-id'

  beforeEach(() => {
    vi.clearAllMocks()
    addApplicationTask.mockResolvedValue({
      marineLicence: { _id: '507f1f77bcf86cd799439011' },
      task: { taskId: 'abc' }
    })
  })

  const run = (body) =>
    updateWithholdingNotification(db, logger, { body, id: messageId })

  it('records both bases when the caseworker flagged both', async () => {
    await run(mockMasWithholdingMessageBody)

    expect(addApplicationTask).toHaveBeenCalledWith(db, logger, {
      applicationReference: mockMasWithholdingMessageBody.applicationReference,
      type: APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION,
      data: {
        nationalSecurity: {
          withheldSome: false,
          comments: mockMasWithholdingMessageBody.nationalSecurity.comments
        },
        commercialConfidentiality: {
          withheldSome: true,
          comments:
            mockMasWithholdingMessageBody.commercialConfidentiality.comments
        }
      },
      updatedBy: messageId
    })
  })

  it('omits commercial confidentiality when it was not flagged', async () => {
    await run(mockMasWithholdingNationalSecurityOnlyMessageBody)

    const { data } = addApplicationTask.mock.calls[0][2]
    expect(data.nationalSecurity).toEqual({
      withheldSome: true,
      comments: 'We agree to withhold the vessel positions.'
    })
    expect(data).not.toHaveProperty('commercialConfidentiality')
  })

  it('omits national security when it was not flagged', async () => {
    await run(mockMasWithholdingCommercialOnlyMessageBody)

    const { data } = addApplicationTask.mock.calls[0][2]
    expect(data.commercialConfidentiality).toEqual({
      withheldSome: false,
      comments: 'This information is standard practice information.'
    })
    expect(data).not.toHaveProperty('nationalSecurity')
  })

  it('emails the applicant a link to the view details page', async () => {
    await run(mockMasWithholdingMessageBody)

    expect(sendWithholdingNotificationEmail).toHaveBeenCalledWith({
      db,
      userName: 'Jane Doe',
      userEmail: 'jane@example.com',
      applicationReference: mockMasWithholdingMessageBody.applicationReference,
      viewDetailsUrl: expect.stringContaining(
        '/marine-licence/view-details/507f1f77bcf86cd799439011'
      )
    })
  })

  it('does not email when the task was not added', async () => {
    addApplicationTask.mockResolvedValue(null)

    await run(mockMasWithholdingMessageBody)

    expect(sendWithholdingNotificationEmail).not.toHaveBeenCalled()
  })
})
