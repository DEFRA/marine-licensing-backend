import { createTaskList, COMPLETED } from './createTaskList'

describe('createTaskList', () => {
  it('should mark tasks as COMPLETED when corresponding exemption properties exist', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project'
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED
    })
  })

  it('should not return tasks when corresponding exemption properties do not exist', () => {
    const exemption = {
      publicRegister: '',
      projectName: null
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({})
  })

  it('should not return tasks when corresponding exemption properties are missing', () => {
    const exemption = {}

    const result = createTaskList(exemption)

    expect(result).toEqual({})
  })
})
