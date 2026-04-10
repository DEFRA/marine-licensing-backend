import { createTaskList } from './createTaskList'
import {
  INCOMPLETE,
  IN_PROGRESS,
  COMPLETED
} from '../../../shared/helpers/task-list-utils.js'
import { mockFileUploadSite } from '../../../../tests/test.fixture.js'

describe('createTaskList', () => {
  it('should mark tasks as COMPLETED when corresponding marineLicence properties exist', () => {
    const marineLicence = {
      projectName: 'Test Project',
      siteDetails: [mockFileUploadSite],
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      projectBackground: 'Some background',
      publicRegister: 'Public Register Info'
    }

    const result = createTaskList(marineLicence)

    expect(result).toEqual({
      projectName: COMPLETED,
      siteDetails: COMPLETED,
      specialLegalPowers: COMPLETED,
      otherAuthorities: COMPLETED,
      projectBackground: COMPLETED,
      publicRegister: COMPLETED
    })
  })

  it('should not include specialLegalPowers task for citizens but should include otherAuthorities', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      projectBackground: 'Some background',
      siteDetails: [mockFileUploadSite],
      publicRegister: 'Public Register Info'
    }

    const result = createTaskList(marineLicence, true)

    expect(result).toEqual({
      projectName: COMPLETED,
      otherAuthorities: COMPLETED,
      projectBackground: COMPLETED,
      siteDetails: COMPLETED,
      publicRegister: COMPLETED
    })
  })

  it('should return tasks as INCOMPLETE when corresponding marineLicence properties are missing', () => {
    const incompleteMockFileUploadSite = { ...mockFileUploadSite }

    delete incompleteMockFileUploadSite.siteName

    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'INCOMPLETE',
      projectBackground: 'Test project background',
      siteDetails: [incompleteMockFileUploadSite]
    }

    const result = createTaskList(marineLicence)

    expect(result).toEqual({
      otherAuthorities: COMPLETED,
      projectName: COMPLETED,
      siteDetails: IN_PROGRESS,
      specialLegalPowers: COMPLETED,
      projectBackground: COMPLETED,
      publicRegister: INCOMPLETE
    })
  })

  it('should return site details as IN_PROGRESS when fields are all missing', () => {
    const marineLicence = {}

    const result = createTaskList(marineLicence)

    expect(result).toEqual({
      projectName: INCOMPLETE,
      specialLegalPowers: INCOMPLETE,
      otherAuthorities: INCOMPLETE,
      projectBackground: INCOMPLETE,
      publicRegister: INCOMPLETE,
      siteDetails: INCOMPLETE
    })
  })

  it('should mark tasks as COMPLETED when all required properties are present', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'some powers',
      publicRegister: 'Public Register Info',
      otherAuthorities: 'Some authorities',
      projectBackground: 'Some background',
      siteDetails: [mockFileUploadSite]
    }

    const result = createTaskList(marineLicence)

    expect(result).toEqual({
      projectName: COMPLETED,
      specialLegalPowers: COMPLETED,
      otherAuthorities: COMPLETED,
      projectBackground: COMPLETED,
      publicRegister: COMPLETED,
      siteDetails: COMPLETED
    })
  })
})
