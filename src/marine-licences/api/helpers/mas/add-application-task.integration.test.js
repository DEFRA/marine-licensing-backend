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

  const add = (data) =>
    addApplicationTask(global.mockMongo, logger, {
      applicationReference: mockMasApplicationReference,
      type,
      data,
      updatedBy: 'message-id'
    })

  const buildTask = (overrides = {}) => ({
    taskId: new ObjectId().toHexString(),
    type,
    receivedAt: new Date('2026-05-21T12:00:00.000Z'),
    resolvedAt: null,
    data: { nationalSecurity: { withheldSome: false, comments: 'first' } },
    ...overrides
  })

  it('adds a task to a licence that has no applicationTasks field at all', async () => {
    const _id = await insertLicence()

    const result = await add({ nationalSecurity: { withheldSome: true } })

    expect(result.superseded).toBe(false)
    const tasks = await tasksOf(_id)
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({
      type,
      resolvedAt: null,
      data: { nationalSecurity: { withheldSome: true } }
    })
  })

  it('adds a second task when the only task of the type is already resolved', async () => {
    const _id = await insertLicence([
      buildTask({ resolvedAt: new Date('2026-05-22T12:00:00.000Z') })
    ])

    const result = await add({ nationalSecurity: { withheldSome: true } })

    expect(result.superseded).toBe(false)
    expect(await tasksOf(_id)).toHaveLength(2)
  })

  it('overwrites the unresolved task in place rather than adding a second', async () => {
    const existing = buildTask()
    const _id = await insertLicence([existing])

    const result = await add({
      commercialConfidentiality: { withheldSome: true, comments: 'superseding' }
    })

    expect(result.superseded).toBe(true)

    const tasks = await tasksOf(_id)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].taskId).toBe(existing.taskId)
    expect(tasks[0].data).toEqual({
      commercialConfidentiality: {
        withheldSome: true,
        comments: 'superseding'
      }
    })
    expect(tasks[0].receivedAt.getTime()).toBeGreaterThan(
      existing.receivedAt.getTime()
    )
    expect(tasks[0].resolvedAt).toBeNull()
  })

  it('leaves an unresolved task of a different type untouched', async () => {
    const otherTask = buildTask({ type: otherType })
    const _id = await insertLicence([otherTask])

    const result = await add({ nationalSecurity: { withheldSome: true } })

    expect(result.superseded).toBe(false)

    const tasks = await tasksOf(_id)
    expect(tasks).toHaveLength(2)
    expect(tasks.find(({ type: t }) => t === otherType)).toEqual(otherTask)
  })

  it('returns null when no licence matches the reference', async () => {
    expect(await add({ nationalSecurity: {} })).toBeNull()
  })
})
