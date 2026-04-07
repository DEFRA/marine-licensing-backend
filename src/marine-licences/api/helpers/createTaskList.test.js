import { createTaskList, COMPLETED } from './createTaskList'

describe('createTaskList', () => {
  it('should mark tasks as COMPLETED when corresponding marineLicence properties exist', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      projectBackground: 'Some background'
    }

    const result = createTaskList(marineLicence)

    expect(result).toEqual({
      projectName: COMPLETED,
      specialLegalPowers: COMPLETED,
      otherAuthorities: COMPLETED,
      projectBackground: COMPLETED
    })
  })

  it('should not include specialLegalPowers task for citizens but should include otherAuthorities', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      projectBackground: 'Some background'
    }

    const result = createTaskList(marineLicence, true)

    expect(result).toEqual({
      projectName: COMPLETED,
      otherAuthorities: COMPLETED,
      projectBackground: COMPLETED
    })
  })

  it('should return tasks as INCOMPLETE when corresponding marineLicence properties are missing', () => {
    const marineLicence = {}

    const result = createTaskList(marineLicence)

    expect(result).toEqual({
      projectName: 'INCOMPLETE',
      specialLegalPowers: 'INCOMPLETE',
      otherAuthorities: 'INCOMPLETE',
      projectBackground: 'INCOMPLETE'
    })
  })

  it('should mark tasks as COMPLETED when all required properties are present', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'some powers',
      otherAuthorities: 'Some authorities',
      projectBackground: 'Some background'
    }

    const result = createTaskList(marineLicence)

    expect(result).toEqual({
      projectName: COMPLETED,
      specialLegalPowers: COMPLETED,
      otherAuthorities: COMPLETED,
      projectBackground: COMPLETED
    })
  })
})
