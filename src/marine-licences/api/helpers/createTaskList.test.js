import { createTaskList } from './createTaskList'
import {
  INCOMPLETE,
  IN_PROGRESS,
  COMPLETED
} from '../../../shared/helpers/task-list-utils.js'
import { mockFileUploadSite } from '../../../../tests/test.fixture.js'
import { createActivityDetails } from './create-empty-activity-details.js'

const completedActivityDetails = [
  {
    activityType: 'Construction',
    activityDescription: 'Building a pier',
    activityDuration: '6 months',
    completionDate: '2025-06-01',
    activityMonths: 'Jan, Feb',
    workingHours: '08:00-17:00'
  }
]

const mockCompleteSite = {
  ...mockFileUploadSite,
  activityDetails: completedActivityDetails
}

describe('createTaskList', () => {
  it('should mark siteDetails as COMPLETED when all site and activity fields are present', () => {
    const marineLicence = {
      projectName: 'Test Project',
      siteDetails: [mockCompleteSite],
      specialLegalPowers: 'Some powers',
      publicRegister: 'Public Register Info',
      otherAuthorities: 'Some authorities'
    }

    expect(createTaskList(marineLicence)).toEqual({
      projectName: COMPLETED,
      siteDetails: COMPLETED,
      specialLegalPowers: COMPLETED,
      publicRegister: COMPLETED,
      otherAuthorities: COMPLETED
    })
  })

  it('should not include specialLegalPowers for citizens', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      publicRegister: 'Public Register Info',
      siteDetails: [mockFileUploadSite],
      otherAuthorities: 'Some authorities'
    }

    expect(createTaskList(marineLicence, true)).toEqual({
      projectName: COMPLETED,
      publicRegister: COMPLETED,
      siteDetails: IN_PROGRESS,
      otherAuthorities: COMPLETED
    })
  })

  it('should return siteDetails as IN_PROGRESS when a site field is missing', () => {
    const siteWithoutSiteName = { ...mockCompleteSite }
    delete siteWithoutSiteName.siteName

    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      siteDetails: [siteWithoutSiteName]
    }

    expect(createTaskList(marineLicence)).toEqual({
      projectName: COMPLETED,
      siteDetails: IN_PROGRESS,
      specialLegalPowers: COMPLETED,
      otherAuthorities: COMPLETED,
      publicRegister: INCOMPLETE
    })
  })

  it('should return siteDetails as IN_PROGRESS when activityDetails fields are empty', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      siteDetails: [
        { ...mockFileUploadSite, activityDetails: [createActivityDetails()] }
      ]
    }

    expect(createTaskList(marineLicence).siteDetails).toBe(IN_PROGRESS)
  })

  it('should return siteDetails as IN_PROGRESS when activityDetails are partially filled', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      siteDetails: [
        {
          ...mockFileUploadSite,
          activityDetails: [
            { ...createActivityDetails(), activityType: 'Construction' }
          ]
        }
      ]
    }

    expect(createTaskList(marineLicence).siteDetails).toBe(IN_PROGRESS)
  })

  it('should handle missing activityDetails', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      siteDetails: [
        {
          ...mockFileUploadSite,
          activityDetails: null
        }
      ]
    }

    expect(createTaskList(marineLicence).siteDetails).toBe(IN_PROGRESS)
  })

  it('should return all tasks as INCOMPLETE when marineLicence has no properties', () => {
    expect(createTaskList({})).toEqual({
      projectName: INCOMPLETE,
      specialLegalPowers: INCOMPLETE,
      publicRegister: INCOMPLETE,
      otherAuthorities: INCOMPLETE,
      siteDetails: INCOMPLETE
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
      siteDetails: IN_PROGRESS
    })
  })
})
