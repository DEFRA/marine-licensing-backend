import { setupTestServer } from '../../../../tests/test-server.js'
import {
  makeGetRequest,
  makePostRequest
} from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../models/test-fixtures.js'
import {
  APPLICATION_TASK_TYPE,
  MARINE_LICENCE_STATUS
} from '../../constants/marine-licence.js'

const buildTask = (
  taskId,
  resolvedAt = null,
  type = APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION
) => ({
  taskId,
  type,
  receivedAt: new Date(),
  resolvedAt,
  resolvedBy: null,
  data: { nationalSecurity: { withheldSome: true, comments: 'Some comments' } }
})

describe('Resolve application task - integration tests', async () => {
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

  const resolve = (id, taskId, contactId) =>
    makePostRequest({
      server: getServer(),
      url: `/marine-licence/${id}/application-tasks/${taskId}/resolve`,
      contactId,
      payload: {}
    })

  const getStatus = async (id, contactId) => {
    const { body } = await makeGetRequest({
      server: getServer(),
      url: `/marine-licence/${id}`,
      contactId
    })
    return body.status
  }

  const storedLicence = (id) =>
    globalThis.mockMongo.collection('marine-licences').findOne({ _id: id })

  test('restores the status held before the task once it is resolved', async () => {
    const taskId = new ObjectId().toHexString()
    const id = await insertLicence([buildTask(taskId)])
    const { contactId } = mockMarineLicence

    expect(await getStatus(id, contactId)).toBe('Action required')

    const { statusCode } = await resolve(id, taskId, contactId)
    expect(statusCode).toBe(200)

    expect(await getStatus(id, contactId)).toBe('Submitted')
    const stored = await storedLicence(id)
    expect(stored.status).toBe(MARINE_LICENCE_STATUS.SUBMITTED)
    expect(stored).not.toHaveProperty('previousStatus')
    expect(stored.applicationTasks[0]).toMatchObject({
      resolvedAt: expect.any(Date),
      resolvedBy: contactId
    })
    expect(stored.updatedBy).toBe(contactId)
  })

  test('stays at Action required until the last outstanding task is resolved', async () => {
    const firstTaskId = new ObjectId().toHexString()
    const secondTaskId = new ObjectId().toHexString()
    const id = await insertLicence([
      buildTask(firstTaskId),
      buildTask(secondTaskId, null, 'SOME_OTHER_TASK')
    ])
    const { contactId } = mockMarineLicence

    await resolve(id, firstTaskId, contactId)
    expect(await getStatus(id, contactId)).toBe('Action required')

    await resolve(id, secondTaskId, contactId)
    expect(await getStatus(id, contactId)).toBe('Submitted')
  })

  test('is idempotent when the same task is resolved twice', async () => {
    const taskId = new ObjectId().toHexString()
    const id = await insertLicence([buildTask(taskId)])
    const { contactId } = mockMarineLicence

    await resolve(id, taskId, contactId)
    const { statusCode } = await resolve(id, taskId, contactId)

    expect(statusCode).toBe(200)
    expect(await getStatus(id, contactId)).toBe('Submitted')
  })

  test('does not undo a transfer that arrived while the task was outstanding', async () => {
    const taskId = new ObjectId().toHexString()
    const id = await insertLicence(
      [buildTask(taskId)],
      MARINE_LICENCE_STATUS.TRANSFERRED
    )

    await resolve(id, taskId, mockMarineLicence.contactId)

    expect((await storedLicence(id)).status).toBe(
      MARINE_LICENCE_STATUS.TRANSFERRED
    )
  })

  test('falls back to Submitted when no previous status was recorded', async () => {
    const taskId = new ObjectId().toHexString()
    const id = await insertLicence([buildTask(taskId)])
    await globalThis.mockMongo
      .collection('marine-licences')
      .updateOne({ _id: id }, { $unset: { previousStatus: '' } })

    await resolve(id, taskId, mockMarineLicence.contactId)

    expect((await storedLicence(id)).status).toBe(
      MARINE_LICENCE_STATUS.SUBMITTED
    )
  })

  describe('a resubmit site notice evidence task', () => {
    const photo = (filename) => ({
      uploadedFile: { filename },
      s3Location: { s3Bucket: 'mmo-uploads', s3Key: filename }
    })

    const buildResubmitTask = (taskId, locations) => ({
      ...buildTask(
        taskId,
        null,
        APPLICATION_TASK_TYPE.RESUBMIT_SITE_NOTICE_EVIDENCE
      ),
      data: { locations }
    })

    const completeLocation = (locationNumber) => ({
      locationNumber,
      reason: 'Blurred',
      closeUpPhoto: photo(`close-up-${locationNumber}.jpg`),
      positionPhoto: photo(`position-${locationNumber}.jpg`)
    })

    test('is refused while a location is missing a photo', async () => {
      const taskId = new ObjectId().toHexString()
      const { closeUpPhoto, ...missingCloseUp } = completeLocation(3)
      const id = await insertLicence([
        buildResubmitTask(taskId, [completeLocation(1), missingCloseUp])
      ])

      const { statusCode } = await resolve(
        id,
        taskId,
        mockMarineLicence.contactId
      )

      expect(statusCode).toBe(409)
      const stored = await storedLicence(id)
      expect(stored.applicationTasks[0].resolvedAt).toBeNull()
      expect(stored.status).toBe(MARINE_LICENCE_STATUS.ACTION_REQUIRED)
    })

    test('is resolved by who sent it, with the previous status restored, once every photo is added', async () => {
      const taskId = new ObjectId().toHexString()
      const id = await insertLicence([
        buildResubmitTask(taskId, [completeLocation(1), completeLocation(3)])
      ])
      const { contactId } = mockMarineLicence

      const { statusCode } = await resolve(id, taskId, contactId)

      expect(statusCode).toBe(200)
      const stored = await storedLicence(id)
      expect(stored.applicationTasks[0]).toMatchObject({
        resolvedAt: expect.any(Date),
        resolvedBy: contactId
      })
      expect(stored.status).toBe(MARINE_LICENCE_STATUS.SUBMITTED)
    })
  })

  test('rejects a user who did not submit the application', async () => {
    const taskId = new ObjectId().toHexString()
    const id = await insertLicence([buildTask(taskId)])

    const { statusCode } = await resolve(
      id,
      taskId,
      new ObjectId().toHexString()
    )

    expect(statusCode).toBe(403)
  })
})
