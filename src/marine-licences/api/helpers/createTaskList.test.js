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
      publicRegister: 'Public Register Info',
      otherAuthorities: 'Some authorities'
    }

    const result = createTaskList(marineLicence)

    expect(result).toEqual({
      projectName: COMPLETED,
      siteDetails: COMPLETED,
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
      siteDetails: [mockFileUploadSite],
      otherAuthorities: 'Some authorities'
    }

    const result = createTaskList(marineLicence, true)

    expect(result).toEqual({
      projectName: COMPLETED,
      publicRegister: COMPLETED,
      siteDetails: COMPLETED,
      otherAuthorities: COMPLETED
    })
  })

  it('should return tasks as INCOMPLETE when corresponding marineLicence properties are missing', () => {
    const incompleteMockFileUploadSite = { ...mockFileUploadSite }

    delete incompleteMockFileUploadSite.siteName

    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'INCOMPLETE',
      siteDetails: [incompleteMockFileUploadSite]
    }

    const result = createTaskList(marineLicence)

    expect(result).toEqual({
      otherAuthorities: COMPLETED,
      projectName: COMPLETED,
      siteDetails: IN_PROGRESS,
      specialLegalPowers: COMPLETED
    })
  })

  it('should return site details as IN_PROGRESS when fields are all missing', () => {
    const marineLicence = {}

    const result = createTaskList(marineLicence)

    expect(result).toEqual({
      projectName: 'INCOMPLETE',
      specialLegalPowers: 'INCOMPLETE',
      publicRegister: 'INCOMPLETE',
      otherAuthorities: 'INCOMPLETE',
      siteDetails: 'INCOMPLETE'
    })
  })

  it('should mark tasks as COMPLETED when all required properties are present', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'some powers',
      publicRegister: 'Public Register Info',
      otherAuthorities: 'Some authorities',
      siteDetails: [mockFileUploadSite]
    }

    const result = createTaskList(marineLicence)

    expect(result).toEqual({
      otherAuthorities: COMPLETED,
      projectName: COMPLETED,
      specialLegalPowers: COMPLETED,
      publicRegister: COMPLETED,
      otherAuthorities: COMPLETED,
      siteDetails: COMPLETED
    })
  })
})
