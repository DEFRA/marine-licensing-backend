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
import { ACTION_REQUIRED_STATUS_LABEL } from '../../../shared/constants/project-status.js'

const buildTask = (taskId, resolvedAt = null) => ({
  taskId,
  type: APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION,
  receivedAt: new Date(),
  resolvedAt,
  data: { nationalSecurity: { withheldSome: true, comments: 'Some comments' } }
})

describe('Resolve application task - integration tests', async () => {
  const getServer = await setupTestServer()

  const insertLicence = async (applicationTasks) => {
    const _id = new ObjectId()
    await globalThis.mockMongo.collection('marine-licences').insertOne({
      ...mockMarineLicence,
      _id,
      organisation: null,
      status: MARINE_LICENCE_STATUS.SUBMITTED,
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

  test('reports Action required while a task is outstanding, and reverts once it is resolved', async () => {
    const taskId = new ObjectId().toHexString()
    const id = await insertLicence([buildTask(taskId)])
    const { contactId } = mockMarineLicence

    expect(await getStatus(id, contactId)).toBe(ACTION_REQUIRED_STATUS_LABEL)

    const { statusCode } = await resolve(id, taskId, contactId)
    expect(statusCode).toBe(200)

    expect(await getStatus(id, contactId)).toBe('Submitted')
  })

  test('stays at Action required until the last outstanding task is resolved', async () => {
    const firstTaskId = new ObjectId().toHexString()
    const secondTaskId = new ObjectId().toHexString()
    const id = await insertLicence([
      buildTask(firstTaskId),
      buildTask(secondTaskId)
    ])
    const { contactId } = mockMarineLicence

    await resolve(id, firstTaskId, contactId)
    expect(await getStatus(id, contactId)).toBe(ACTION_REQUIRED_STATUS_LABEL)

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

  test('never exposes application tasks on the public register response', async () => {
    const taskId = new ObjectId().toHexString()
    const id = await insertLicence([buildTask(taskId)])

    const { body } = await makeGetRequest({
      server: getServer(),
      url: `/public/marine-licence/${id}`
    })

    expect(body.applicationTasks).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain('Some comments')
    expect(body.status).toBe('Submitted')
  })
})
