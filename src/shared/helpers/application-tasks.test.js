import {
  getDisplayStatus,
  hasOutstandingApplicationTasks,
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

describe('outstandingTasksQuery', () => {
  it('matches licences with at least one unresolved task', () => {
    expect(outstandingTasksQuery).toEqual({
      applicationTasks: { $elemMatch: { resolvedAt: null } }
    })
  })
})
