import {
  hasOutstandingApplicationTasks,
  noOutstandingTasksQuery,
  outstandingTasksQuery
} from './application-tasks.js'

const outstanding = { taskId: 'a', resolvedAt: null }
const resolved = { taskId: 'b', resolvedAt: new Date() }

describe('Application task Mongo predicates - integration tests', () => {
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

  // This collection is not one the global beforeEach empties, so it manages itself.
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

  test('matches exactly the projects with at least one unresolved task', async () => {
    expect(await namesMatching(outstandingTasksQuery)).toEqual([
      'missingResolvedAt',
      'mixed',
      'outstanding'
    ])
  })

  test('matches exactly the projects the outstanding predicate does not', async () => {
    expect(await namesMatching(noOutstandingTasksQuery)).toEqual([
      'empty',
      'none',
      'resolved'
    ])
  })

  test('agrees with hasOutstandingApplicationTasks on every seeded project', async () => {
    const matched = new Set(await namesMatching(outstandingTasksQuery))

    for (const { name, applicationTasks } of Object.values(seeded)) {
      expect(hasOutstandingApplicationTasks(applicationTasks)).toBe(
        matched.has(name)
      )
    }
  })
})
