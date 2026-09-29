import { vi } from 'vitest'
import { handleWithholdingNotification } from './handle-withholding-notification.js'
import { addApplicationTask } from './add-application-task.js'
import { sendWithholdingNotificationEmail } from './send-withholding-notification-email.js'
import {
  APPLICATION_TASK_TYPE,
  MAS_EVENT_ACTION,
  WITHHOLDING_DECISION
} from '../../../constants/marine-licence.js'
import {
  mockMasUserEmail,
  mockMasUserName,
  mockMasWithholdingMessageBody,
  mockMasWithholdingNationalSecurityOnlyMessageBody,
  mockMasWithholdingCommercialOnlyMessageBody,
  mockMasWithholdingNoBasisMessageBody
} from './test-fixtures.js'

vi.mock('./add-application-task.js', () => ({
  addApplicationTask: vi.fn()
}))
vi.mock('./send-withholding-notification-email.js', () => ({
  sendWithholdingNotificationEmail: vi.fn()
}))

describe('handleWithholdingNotification', () => {
  const db = { collection: vi.fn() }
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const messageId = 'message-id'

  beforeEach(() => {
    addApplicationTask.mockResolvedValue({
      marineLicence: { _id: '507f1f77bcf86cd799439011' },
      task: { taskId: 'abc' }
    })
  })

  const run = (body) =>
    handleWithholdingNotification(db, logger, { body, id: messageId })

  it('records both bases when the request relates to both', async () => {
    await run(mockMasWithholdingMessageBody)

    expect(addApplicationTask).toHaveBeenCalledWith(db, logger, {
      applicationReference: mockMasWithholdingMessageBody.applicationReference,
      type: APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION,
      data: {
        decisionDate: mockMasWithholdingMessageBody.decisionDate,
        nationalSecurity: {
          decision: WITHHOLDING_DECISION.DISAGREE,
          applicantMessage:
            mockMasWithholdingMessageBody.nationalSecurityApplicantMessage
        },
        commercialConfidentiality: {
          decision: WITHHOLDING_DECISION.AGREE_IN_PART,
          applicantMessage:
            mockMasWithholdingMessageBody.commercialApplicantMessage
        }
      },
      updatedBy: messageId
    })
  })

  it('omits commercial confidentiality when the request relates to national security', async () => {
    await run(mockMasWithholdingNationalSecurityOnlyMessageBody)

    const { data } = addApplicationTask.mock.calls[0][2]
    expect(data.nationalSecurity).toEqual({
      decision: WITHHOLDING_DECISION.AGREE,
      applicantMessage: 'We agree to withhold the vessel positions.'
    })
    expect(data).not.toHaveProperty('commercialConfidentiality')
  })

  it('omits national security when the request relates to commercial confidentiality', async () => {
    await run(mockMasWithholdingCommercialOnlyMessageBody)

    const { data } = addApplicationTask.mock.calls[0][2]
    expect(data.commercialConfidentiality).toEqual({
      decision: WITHHOLDING_DECISION.DISAGREE,
      applicantMessage: 'This information is standard practice information.'
    })
    expect(data).not.toHaveProperty('nationalSecurity')
  })

  it('ignores a decision for a basis the request does not relate to', async () => {
    await run({
      ...mockMasWithholdingCommercialOnlyMessageBody,
      nationalSecurityDecision: WITHHOLDING_DECISION.AGREE,
      nationalSecurityApplicantMessage: 'Should not reach the applicant'
    })

    const { data } = addApplicationTask.mock.calls[0][2]
    expect(data).not.toHaveProperty('nationalSecurity')
  })

  it('discards a basis whose decision is not one MAS is contracted to send', async () => {
    const result = await run({
      ...mockMasWithholdingCommercialOnlyMessageBody,
      commercialDecision: 'MAYBE'
    })

    expect(result).toBeNull()
    expect(addApplicationTask).not.toHaveBeenCalled()
  })

  it('discards a message whose requestRelatesTo is unrecognised', async () => {
    const result = await run({
      ...mockMasWithholdingMessageBody,
      requestRelatesTo: 'SOMETHING_ELSE'
    })

    expect(result).toBeNull()
    expect(addApplicationTask).not.toHaveBeenCalled()
  })

  it('raises the task but sends no email when the message carries no recipient', async () => {
    const result = await run({
      ...mockMasWithholdingMessageBody,
      userName: undefined,
      userEmail: undefined
    })

    expect(result).not.toBeNull()
    expect(addApplicationTask).toHaveBeenCalled()
    expect(sendWithholdingNotificationEmail).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          reason: 'no recipient on message'
        })
      }),
      expect.stringContaining('sent no email')
    )
  })

  it('emails the applicant a link to the view details page', async () => {
    await run(mockMasWithholdingMessageBody)

    expect(sendWithholdingNotificationEmail).toHaveBeenCalledWith({
      db,
      userName: mockMasUserName,
      userEmail: mockMasUserEmail,
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

  it('raises no task and sends no email when the message carries no decision', async () => {
    const result = await run(mockMasWithholdingNoBasisMessageBody)

    expect(result).toBeNull()
    expect(addApplicationTask).not.toHaveBeenCalled()
    expect(sendWithholdingNotificationEmail).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          action: MAS_EVENT_ACTION.APPLICATION_TASK_SKIPPED,
          outcome: 'failure'
        })
      }),
      expect.stringContaining('Discarding withholding notification')
    )
  })
})
