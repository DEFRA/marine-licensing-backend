import { createTaskList, COMPLETED, NOT_STARTED } from './createTaskList'

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

  it('should mark tasks as NOT_STARTED when corresponding exemption properties do not exist', () => {
    const exemption = {
      publicRegister: '',
      projectName: null
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: NOT_STARTED,
      projectName: NOT_STARTED
    })
  })

  it('should mark tasks as NOT_STARTED when corresponding exemption properties are missing', () => {
    const exemption = {}

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: NOT_STARTED,
      projectName: NOT_STARTED
    })
  })
})
