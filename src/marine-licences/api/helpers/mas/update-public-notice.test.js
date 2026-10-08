import { vi } from 'vitest'
import { updatePublicNotice } from './update-public-notice.js'
import { addApplicationTask } from './add-application-task.js'
import { mockMasPublicNoticeSqsMessage } from './test-fixtures.js'
import { sendPublicNoticeEmail } from './send-public-notice-email.js'
import { APPLICATION_TASK_TYPE } from '../../../constants/marine-licence.js'
import { randomUUID } from 'node:crypto'

vi.mock('./add-application-task.js', () => ({
  addApplicationTask: vi.fn()
}))
vi.mock('./send-public-notice-email.js', () => ({
  sendPublicNoticeEmail: vi.fn()
}))

describe('updatePublicNotice', async () => {
  const mockLicenceId = randomUUID()

  beforeEach(() => {
    addApplicationTask.mockResolvedValue({
      marineLicence: { _id: mockLicenceId },
      task: { taskId: 'abc' }
    })
  })

  const buildServer = () => ({
    db: { collection: vi.fn() },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  })

  const body = JSON.parse(mockMasPublicNoticeSqsMessage.Body)

  const run = (bodyOverride = {}) =>
    updatePublicNotice(buildServer().db, buildServer().logger, {
      body: { ...body, ...bodyOverride },
      id: mockMasPublicNoticeSqsMessage.MessageId
    })

  it('adds a public site notice task with the correct data', async () => {
    await run()

    expect(addApplicationTask).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      {
        applicationReference: body.applicationReference,
        type: APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE,
        data: {
          summary: {
            proposedWorksSummary: body.proposedWorksSummary,
            siteNoticeSummary: body.siteNoticeSummary
          },
          requestRelatesTo: body.requestRelatesTo
        },
        updatedBy: mockMasPublicNoticeSqsMessage.MessageId
      }
    )
  })

  it('sends the correct email when a licence is matched', async () => {
    await run()

    expect(sendPublicNoticeEmail).toHaveBeenCalledWith({
      db: expect.any(Object),
      userName: body.userName,
      userEmail: body.userEmail,
      applicationReference: body.applicationReference,
      viewDetailsUrl: `http://localhost:3000/marine-licence/view-details/${mockLicenceId}`
    })
  })

  it('returns the result when a licence is matched', async () => {
    const server = buildServer()
    const result = await updatePublicNotice(server.db, server.logger, {
      body,
      id: mockMasPublicNoticeSqsMessage.MessageId
    })

    expect(result).toEqual({
      marineLicence: { _id: mockLicenceId },
      task: { taskId: 'abc' }
    })
  })

  it('returns null when addApplicationTask returns null', async () => {
    addApplicationTask.mockResolvedValue(null)

    const result = await run()

    expect(result).toBeNull()
    expect(sendPublicNoticeEmail).not.toHaveBeenCalled()
  })

  it('raises the task but sends no email when the message carries no recipient', async () => {
    const server = buildServer()
    const result = await updatePublicNotice(server.db, server.logger, {
      body: { ...body, userName: undefined, userEmail: undefined },
      id: mockMasPublicNoticeSqsMessage.MessageId
    })

    expect(result).not.toBeNull()
    expect(addApplicationTask).toHaveBeenCalled()
    expect(sendPublicNoticeEmail).not.toHaveBeenCalled()
    expect(server.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          reason: 'no recipient on message'
        })
      }),
      expect.stringContaining('sent no email')
    )
  })

  it('does not email when the task was not added', async () => {
    addApplicationTask.mockResolvedValue(null)

    await run()

    expect(sendPublicNoticeEmail).not.toHaveBeenCalled()
  })
})
