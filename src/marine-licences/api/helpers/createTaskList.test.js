import { createTaskList, COMPLETED } from './createTaskList'

describe('createTaskList', () => {
  it('should mark tasks as COMPLETED when corresponding marineLicense properties exist', () => {
    const marineLicense = {
      projectName: 'Test Project'
    }

    const result = createTaskList(marineLicense)

    expect(result).toEqual({
      projectName: COMPLETED
    })
  })

  it('should return tasks as INCOMPLETE when corresponding marineLicense properties are missing', () => {
    const marineLicense = {}

    const result = createTaskList(marineLicense)

    expect(result).toEqual({
      projectName: 'INCOMPLETE'
    })
  })

  it('should correctly handle an empty object', () => {
    const marineLicense = {
      projectName: 'Test Project'
    }

    const result = createTaskList(marineLicense)

    expect(result).toEqual({
      projectName: COMPLETED
    })
  })
})
