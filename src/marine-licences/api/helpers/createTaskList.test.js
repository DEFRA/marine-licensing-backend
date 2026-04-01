import { createTaskList, COMPLETED } from './createTaskList'

describe('createTaskList', () => {
  it('should mark tasks as COMPLETED when corresponding marineLicence properties exist', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      publicRegister: 'Public Register Info',
      otherAuthorities: 'Some authorities'
    }

    const result = createTaskList(marineLicence)

    expect(result).toEqual({
      projectName: COMPLETED,
      specialLegalPowers: COMPLETED,
      publicRegister: COMPLETED,
      otherAuthorities: COMPLETED
    })
  })

  it('should not include specialLegalPowers task for citizens but should include otherAuthorities', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      publicRegister: 'Public Register Info',
      otherAuthorities: 'Some authorities'
    }

    const result = createTaskList(marineLicence, true)

    expect(result).toEqual({
      projectName: COMPLETED,
      publicRegister: COMPLETED,
      otherAuthorities: COMPLETED
    })
  })

  it('should return tasks as INCOMPLETE when corresponding marineLicence properties are missing', () => {
    const marineLicence = {}

    const result = createTaskList(marineLicence)

    expect(result).toEqual({
      projectName: 'INCOMPLETE',
      specialLegalPowers: 'INCOMPLETE',
      publicRegister: 'INCOMPLETE',
      otherAuthorities: 'INCOMPLETE'
    })
  })

  it('should mark tasks as COMPLETED when all required properties are present', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'some powers',
      publicRegister: 'Public Register Info',
      otherAuthorities: 'Some authorities'
    }

    const result = createTaskList(marineLicence)

    expect(result).toEqual({
      projectName: COMPLETED,
      specialLegalPowers: COMPLETED,
      publicRegister: COMPLETED,
      otherAuthorities: COMPLETED
    })
  })
})
