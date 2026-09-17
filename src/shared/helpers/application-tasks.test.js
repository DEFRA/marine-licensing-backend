import {
  getDisplayStatus,
  hasOutstandingApplicationTasks,
  noOutstandingTasksQuery,
  outstandingTasksQuery
} from './application-tasks.js'

const outstanding = { taskId: 'a', resolvedAt: null }
const resolved = { taskId: 'b', resolvedAt: new Date() }

describe('hasOutstandingApplicationTasks', () => {
  it.each([
    ['undefined', undefined, false],
    ['empty', [], false],
    ['all resolved', [resolved], false],
    ['one outstanding', [outstanding], true],
    ['mixed', [resolved, outstanding], true]
  ])('returns %s correctly', (_name, tasks, expected) => {
    expect(hasOutstandingApplicationTasks(tasks)).toBe(expected)
  })
})

describe('getDisplayStatus', () => {
  it('returns the stored status when there are no tasks', () => {
    expect(getDisplayStatus({ status: 'Submitted' })).toBe('Submitted')
  })

  it('returns Action required while any task is outstanding', () => {
    expect(
      getDisplayStatus({ status: 'Submitted', applicationTasks: [outstanding] })
    ).toBe('Action required')
  })

  it('reverts to the stored status once every task is resolved', () => {
    expect(
      getDisplayStatus({ status: 'Submitted', applicationTasks: [resolved] })
    ).toBe('Submitted')
  })

  it('still reports Action required when only one of several tasks is resolved', () => {
    expect(
      getDisplayStatus({
        status: 'Submitted',
        applicationTasks: [resolved, outstanding]
      })
    ).toBe('Action required')
  })

  it('reverts to whatever the stored status is, not a hard-coded Submitted', () => {
    expect(
      getDisplayStatus({ status: 'Transferred', applicationTasks: [resolved] })
    ).toBe('Transferred')
  })
})

describe('the Mongo task predicates', () => {
  const collection = () => global.mockMongo.collection('application-task-query')

  const seeded = {
    none: { name: 'none' },
    empty: { name: 'empty', applicationTasks: [] },
    resolved: { name: 'resolved', applicationTasks: [resolved] },
    outstanding: { name: 'outstanding', applicationTasks: [outstanding] },
    mixed: { name: 'mixed', applicationTasks: [resolved, outstanding] },
    missingResolvedAt: {
      name: 'missingResolvedAt',
      applicationTasks: [{ taskId: 'c' }]
    }
  }

  beforeAll(async () => {
    await collection().insertMany(Object.values(seeded))
  })

  afterAll(async () => {
    await collection().drop()
  })

  const namesMatching = async (query) =>
    (await collection().find(query).project({ name: 1 }).toArray())
      .map(({ name }) => name)
      .sort()

  it('matches exactly the projects with at least one unresolved task', async () => {
    expect(await namesMatching(outstandingTasksQuery)).toEqual([
      'missingResolvedAt',
      'mixed',
      'outstanding'
    ])
  })

  it('matches exactly the projects the outstanding predicate does not', async () => {
    expect(await namesMatching(noOutstandingTasksQuery)).toEqual([
      'empty',
      'none',
      'resolved'
    ])
  })

  it('agrees with hasOutstandingApplicationTasks on every seeded project', async () => {
    const matched = new Set(await namesMatching(outstandingTasksQuery))

    for (const { name, applicationTasks } of Object.values(seeded)) {
      expect(hasOutstandingApplicationTasks(applicationTasks)).toBe(
        matched.has(name)
      )
    }
  })
})
