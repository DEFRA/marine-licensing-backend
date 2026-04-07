import {
  COMPLETED,
  IN_PROGRESS,
  INCOMPLETE,
  getStatusFromRequiredFields,
  buildTaskList
} from './task-list-utils.js'

describe('getStatusFromRequiredFields', () => {
  it('returns COMPLETED when every required field is present', () => {
    const obj = { a: 1, b: 2 }
    expect(getStatusFromRequiredFields(obj, ['a', 'b'])).toBe(COMPLETED)
  })

  it('returns INCOMPLETE when no required fields are present', () => {
    const obj = {}
    expect(getStatusFromRequiredFields(obj, ['a', 'b'])).toBe(INCOMPLETE)
  })

  it('returns IN_PROGRESS when some but not all required fields are present', () => {
    const obj = { a: 1 }
    expect(getStatusFromRequiredFields(obj, ['a', 'b'])).toBe(IN_PROGRESS)
  })

  it('treats a key as present when the property exists, even if the value is undefined', () => {
    const obj = { a: undefined }
    expect(getStatusFromRequiredFields(obj, ['a', 'b'])).toBe(IN_PROGRESS)
  })
})

describe('buildTaskList', () => {
  it('maps each task name to a status using the entity field value', () => {
    const entity = { projectName: 'x', siteDetails: null }
    const tasks = {
      projectName: (value) => (value ? COMPLETED : INCOMPLETE),
      siteDetails: (value) => (value ? COMPLETED : INCOMPLETE)
    }

    expect(buildTaskList(entity, tasks)).toEqual({
      projectName: COMPLETED,
      siteDetails: INCOMPLETE
    })
  })

  it('omits a task when decideStatus returns a falsy value', () => {
    const entity = { skipMe: true }
    const tasks = {
      incorrect: () => null
    }

    expect(buildTaskList(entity, tasks)).toEqual({})
  })
})
