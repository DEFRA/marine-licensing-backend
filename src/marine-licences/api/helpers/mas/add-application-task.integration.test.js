import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { addApplicationTask } from './add-application-task.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { APPLICATION_TASK_TYPE } from '../../../constants/marine-licence.js'
import { mockMasApplicationReference } from './test-fixtures.js'

const type = APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION
const otherType = 'SOME_OTHER_TASK'

describe('addApplicationTask - integration tests', () => {
  const collection = () => global.mockMongo.collection(collectionMarineLicences)
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

  const insertLicence = async (applicationTasks) => {
    const _id = new ObjectId()
    await collection().insertOne({
      _id,
      applicationReference: mockMasApplicationReference,
      ...(applicationTasks && { applicationTasks })
    })
    return _id
  }

  const tasksOf = async (_id) =>
    (await collection().findOne({ _id })).applicationTasks

  const add = (data, updatedBy = 'message-id') =>
    addApplicationTask(global.mockMongo, logger, {
      applicationReference: mockMasApplicationReference,
      type,
      data,
      updatedBy
    })

  const buildTask = (overrides = {}) => ({
    taskId: new ObjectId().toHexString(),
    type,
    receivedAt: new Date('2026-05-21T12:00:00.000Z'),
    resolvedAt: null,
    sourceMessageId: 'an-earlier-message',
    data: { nationalSecurity: { withheldSome: false, comments: 'first' } },
    ...overrides
  })

  it('adds a task to a licence that has no applicationTasks field at all', async () => {
    const _id = await insertLicence()

    const result = await add({ nationalSecurity: { withheldSome: true } })

    expect(result.task.taskId).toEqual(expect.any(String))
    const tasks = await tasksOf(_id)
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({
      type,
      resolvedAt: null,
      sourceMessageId: 'message-id',
      data: { nationalSecurity: { withheldSome: true } }
    })
  })

  it('refuses a second task of the type once the first has been read', async () => {
    const existing = buildTask({
      resolvedAt: new Date('2026-05-22T12:00:00.000Z')
    })
    const _id = await insertLicence([existing])

    const result = await add({ nationalSecurity: { withheldSome: true } })

    expect(result).toBeNull()
    expect(await tasksOf(_id)).toEqual([existing])
  })

  it('refuses a second task of the type while the first is still unread', async () => {
    const existing = buildTask()
    const _id = await insertLicence([existing])

    const result = await add({
      commercialConfidentiality: { withheldSome: true, comments: 'second' }
    })

    expect(result).toBeNull()
    expect(await tasksOf(_id)).toEqual([existing])
  })

  it('ignores a redelivery of the message that created the task', async () => {
    const existing = buildTask({ sourceMessageId: 'message-id' })
    const _id = await insertLicence([existing])

    const result = await add({ nationalSecurity: { withheldSome: true } })

    expect(result).toBeNull()
    expect(await tasksOf(_id)).toEqual([existing])
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('leaves an unresolved task of a different type untouched', async () => {
    const otherTask = buildTask({ type: otherType })
    const _id = await insertLicence([otherTask])

    const result = await add({ nationalSecurity: { withheldSome: true } })

    expect(result.task.type).toBe(type)

    const tasks = await tasksOf(_id)
    expect(tasks).toHaveLength(2)
    expect(tasks.find(({ type: t }) => t === otherType)).toEqual(otherTask)
  })

  it('returns null when no licence matches the reference', async () => {
    expect(await add({ nationalSecurity: {} })).toBeNull()
  })
})
