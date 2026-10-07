import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { addApplicationTask } from './add-application-task.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import {
  APPLICATION_TASK_TYPE,
  MARINE_LICENCE_STATUS
} from '../../../constants/marine-licence.js'
import { mockMasApplicationReference } from './test-fixtures.js'

const type = APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION
const otherType = 'SOME_OTHER_TASK'

describe('addApplicationTask - integration tests', () => {
  const collection = () => global.mockMongo.collection(collectionMarineLicences)
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

  const insertLicence = async (applicationTasks, fields = {}) => {
    const _id = new ObjectId()
    await collection().insertOne({
      _id,
      applicationReference: mockMasApplicationReference,
      ...(applicationTasks && { applicationTasks }),
      ...fields
    })
    return _id
  }

  const stored = (_id) => collection().findOne({ _id })

  const tasksOf = async (_id) => (await stored(_id)).applicationTasks

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
    expect(await stored(_id)).not.toHaveProperty('siteNoticeEvidence')
  })

  it.each([
    ['read', new Date('2026-05-22T12:00:00.000Z')],
    ['unread', null]
  ])(
    'refuses a second task of the type while the first is %s',
    async (_state, resolvedAt) => {
      const existing = buildTask({ resolvedAt })
      const _id = await insertLicence([existing])

      const result = await add({ nationalSecurity: { withheldSome: true } })

      expect(result).toBeNull()
      expect(await tasksOf(_id)).toEqual([existing])
    }
  )

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

  it('moves a submitted licence to ACTION_REQUIRED and records what it was', async () => {
    const _id = await insertLicence(undefined, {
      status: MARINE_LICENCE_STATUS.SUBMITTED
    })

    await add({ nationalSecurity: { withheldSome: true } })

    expect(await stored(_id)).toMatchObject({
      status: MARINE_LICENCE_STATUS.ACTION_REQUIRED,
      previousStatus: MARINE_LICENCE_STATUS.SUBMITTED
    })
  })

  it('keeps the recorded status when a second task type arrives', async () => {
    const _id = await insertLicence([buildTask({ type: otherType })], {
      status: MARINE_LICENCE_STATUS.ACTION_REQUIRED,
      previousStatus: MARINE_LICENCE_STATUS.SUBMITTED
    })

    await add({ nationalSecurity: { withheldSome: true } })

    expect(await stored(_id)).toMatchObject({
      status: MARINE_LICENCE_STATUS.ACTION_REQUIRED,
      previousStatus: MARINE_LICENCE_STATUS.SUBMITTED
    })
  })

  it.each([
    MARINE_LICENCE_STATUS.DRAFT,
    MARINE_LICENCE_STATUS.WITHDRAWN,
    MARINE_LICENCE_STATUS.REJECTED,
    MARINE_LICENCE_STATUS.TRANSFERRED
  ])('adds the task but leaves a %s licence at its status', async (status) => {
    const _id = await insertLicence(undefined, { status })

    const result = await add({ nationalSecurity: { withheldSome: true } })

    expect(result.task.type).toBe(type)
    const licence = await stored(_id)
    expect(licence.status).toBe(status)
    expect(licence).not.toHaveProperty('previousStatus')
  })

  it('seeds an empty site notice evidence item with a public site notice task', async () => {
    const _id = await insertLicence()

    const result = await addApplicationTask(global.mockMongo, logger, {
      applicationReference: mockMasApplicationReference,
      type: APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE,
      data: { publicNoticeRequirement: 'SITE_NOTICE' },
      updatedBy: 'message-id'
    })

    expect(result.task.type).toBe(APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE)
    expect((await stored(_id)).siteNoticeEvidence).toEqual([{}])
  })

  it('does not append another evidence item when the public site notice task already exists', async () => {
    const existing = buildTask({
      type: APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE
    })
    const _id = await insertLicence([existing], {
      siteNoticeEvidence: [{ locationName: 'North pier' }]
    })

    const result = await addApplicationTask(global.mockMongo, logger, {
      applicationReference: mockMasApplicationReference,
      type: APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE,
      data: { publicNoticeRequirement: 'SITE_NOTICE' },
      updatedBy: 'another-message'
    })

    expect(result).toBeNull()
    expect((await stored(_id)).siteNoticeEvidence).toEqual([
      { locationName: 'North pier' }
    ])
  })

  it('stores an applicant message starting with $ verbatim', async () => {
    const _id = await insertLicence()

    await add({ commercialConfidentiality: { applicantMessage: '$status' } })

    const [task] = await tasksOf(_id)
    expect(task.data.commercialConfidentiality.applicantMessage).toBe('$status')
  })
})
