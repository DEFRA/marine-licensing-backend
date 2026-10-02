import { setupTestServer } from '../../../../tests/test-server.js'
import { makePostRequest } from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../models/test-fixtures.js'
import {
  APPLICATION_TASK_TYPE,
  MARINE_LICENCE_STATUS
} from '../../constants/marine-licence.js'

const buildTask = (
  type = APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION,
  resolvedAt = null,
  extra = {}
) => ({
  taskId: new ObjectId().toHexString(),
  type,
  receivedAt: new Date(),
  resolvedAt,
  data: { nationalSecurity: { withheldSome: true, comments: 'Some comments' } },
  ...extra
})

describe('Send site notice evidence - integration tests', async () => {
  const getServer = await setupTestServer()

  const insertLicence = async (
    applicationTasks,
    status = MARINE_LICENCE_STATUS.ACTION_REQUIRED
  ) => {
    const _id = new ObjectId()

    await globalThis.mockMongo.collection('marine-licences').insertOne({
      ...mockMarineLicence,
      _id,
      organisation: null,
      status,
      previousStatus: MARINE_LICENCE_STATUS.SUBMITTED,
      applicationTasks
    })
    return _id
  }

  const sendSiteNoticeEvidence = (id, contactId) =>
    makePostRequest({
      server: getServer(),
      url: '/marine-licence/send-site-notice-evidence',
      contactId,
      payload: { id }
    })

  const storedLicence = (id) =>
    globalThis.mockMongo.collection('marine-licences').findOne({ _id: id })

  test('sends site notice evidence and sets evidenceCompletedAt on the PUBLIC_SITE_NOTICE task', async () => {
    const taskId = new ObjectId().toHexString()
    const publicNoticeTask = buildTask(
      APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE,
      null,
      { taskId }
    )
    const id = await insertLicence([publicNoticeTask])
    const { contactId } = mockMarineLicence

    const { statusCode } = await sendSiteNoticeEvidence(
      id.toString(),
      contactId
    )
    expect(statusCode).toBe(200)

    const stored = await storedLicence(id)
    const task = stored.applicationTasks[0]
    expect(task.type).toBe(APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE)
    expect(task).toHaveProperty('evidenceCompletedAt')
    expect(task.evidenceCompletedAt).toBeInstanceOf(Date)
  })

  test('rejects when no PUBLIC_SITE_NOTICE task exists', async () => {
    const taskId = new ObjectId().toHexString()
    const withholdingTask = buildTask(
      APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION,
      null
    )
    withholdingTask.taskId = taskId
    const id = await insertLicence([withholdingTask])

    const { statusCode } = await sendSiteNoticeEvidence(
      id.toString(),
      mockMarineLicence.contactId
    )

    expect(statusCode).toBe(404)
  })

  test('rejects when the PUBLIC_SITE_NOTICE task is already resolved', async () => {
    const taskId = new ObjectId().toHexString()
    const resolvedTask = buildTask(
      APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE,
      new Date('2026-01-01'),
      { taskId }
    )
    const id = await insertLicence([resolvedTask])

    const { statusCode } = await sendSiteNoticeEvidence(
      id.toString(),
      mockMarineLicence.contactId
    )

    expect(statusCode).toBe(404)
  })

  test('does not update evidence fields on other tasks', async () => {
    const publicNoticeTaskId = new ObjectId().toHexString()
    const withholdingTaskId = new ObjectId().toHexString()
    const publicNoticeTask = buildTask(
      APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE,
      null,
      { taskId: publicNoticeTaskId }
    )
    const withholdingTask = buildTask(
      APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION,
      null,
      { taskId: withholdingTaskId }
    )
    const id = await insertLicence([publicNoticeTask, withholdingTask])

    await sendSiteNoticeEvidence(id.toString(), mockMarineLicence.contactId)

    const stored = await storedLicence(id)
    const withholdingTaskStored = stored.applicationTasks.find(
      (t) => t.type === APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION
    )
    expect(withholdingTaskStored).not.toHaveProperty('evidenceCompletedAt')
  })

  test('rejects a user who did not submit the application', async () => {
    const taskId = new ObjectId().toHexString()
    const publicNoticeTask = buildTask(
      APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE,
      null,
      { taskId }
    )
    const id = await insertLicence([publicNoticeTask])

    const { statusCode } = await sendSiteNoticeEvidence(
      id.toString(),
      new ObjectId().toHexString()
    )

    expect(statusCode).toBe(403)
  })

  test('sets updatedAt on the marine licence document', async () => {
    const taskId = new ObjectId().toHexString()
    const publicNoticeTask = buildTask(
      APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE,
      null,
      { taskId }
    )
    const id = await insertLicence([publicNoticeTask])

    const mockDate = new Date('2026-06-15T12:00:00.000Z')
    vi.spyOn(global, 'Date').mockImplementation(function () {
      return mockDate
    })
    Date.now = vi.fn(() => mockDate.getTime())

    const { contactId } = mockMarineLicence
    await sendSiteNoticeEvidence(id.toString(), contactId)

    const after = await storedLicence(id)
    expect(after.updatedAt).toEqual(mockDate)
  })
})
