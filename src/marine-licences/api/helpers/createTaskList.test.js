import { createTaskList } from './createTaskList'
import {
  INCOMPLETE,
  IN_PROGRESS,
  COMPLETED
} from '../../../shared/helpers/task-list-utils.js'
import {
  mockFileUploadSite,
  mockCircleSite,
  mockMultipleSite
} from '../../../../tests/test.fixture.js'
import { createActivityDetails } from './create-empty-activity-details.js'

const completedActivityDetails = [
  {
    activityType: 'Construction',
    activitySubType: 'construction-type-1',
    activities: { selections: ['CON1'] },
    activityDescription: 'Building a pier',
    activityDuration: '6 months',
    activityMonths: { months: 'yes', details: 'Jan, Feb' },
    completionDate: { date: 'yes', reason: 'test' },
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
      otherAuthorities: 'Some authorities',
      projectBackground: 'Some background',
      publicRegister: 'Public Register Info',
      publicConsultation: {
        consulted: 'yes',
        details: 'Public consultation details'
      }
    }

    expect(createTaskList(marineLicence)).toEqual({
      projectName: COMPLETED,
      siteDetails: COMPLETED,
      specialLegalPowers: COMPLETED,
      otherAuthorities: COMPLETED,
      projectBackground: COMPLETED,
      publicConsultation: COMPLETED,
      publicRegister: COMPLETED
    })
  })

  it('should not include specialLegalPowers for citizens', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      projectBackground: 'Some background',
      siteDetails: [mockFileUploadSite],
      publicRegister: 'Public Register Info',
      publicConsultation: {
        consulted: 'yes',
        details: 'Public consultation details'
      }
    }

    expect(createTaskList(marineLicence, true)).toEqual({
      projectName: COMPLETED,
      publicRegister: COMPLETED,
      siteDetails: IN_PROGRESS,
      otherAuthorities: COMPLETED,
      projectBackground: COMPLETED,
      publicConsultation: COMPLETED
    })
  })

  it('should return siteDetails as IN_PROGRESS when a site field is missing', () => {
    const siteWithoutSiteName = { ...mockCompleteSite }
    delete siteWithoutSiteName.siteName

    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      siteDetails: [siteWithoutSiteName],
      projectBackground: 'Test project background'
    }

    expect(createTaskList(marineLicence)).toEqual({
      projectName: COMPLETED,
      siteDetails: IN_PROGRESS,
      specialLegalPowers: COMPLETED,
      otherAuthorities: COMPLETED,
      projectBackground: COMPLETED,
      publicConsultation: INCOMPLETE,
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

  it('should return siteDetails as IN_PROGRESS when a later activity detail entry is incomplete', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      siteDetails: [
        {
          ...mockFileUploadSite,
          activityDetails: [
            completedActivityDetails[0],
            { ...completedActivityDetails[0], workingHours: '' }
          ]
        }
      ]
    }

    expect(createTaskList(marineLicence).siteDetails).toBe(IN_PROGRESS)
  })

  it('should return siteDetails as IN_PROGRESS when activityMonths has no date', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      siteDetails: [
        {
          ...mockFileUploadSite,
          activityDetails: [
            { ...completedActivityDetails[0], activityMonths: {} }
          ]
        }
      ]
    }

    expect(createTaskList(marineLicence).siteDetails).toBe(IN_PROGRESS)
  })

  it('should return siteDetails as IN_PROGRESS when completionDate has no date', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      siteDetails: [
        {
          ...mockFileUploadSite,
          activityDetails: [
            { ...completedActivityDetails[0], completionDate: {} }
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

  describe('circle site (coordinatesType=coordinates, coordinatesEntry=single)', () => {
    it('should return siteDetails as COMPLETED when all circle fields and activity details are present', () => {
      const marineLicence = {
        projectName: 'Test Project',
        specialLegalPowers: 'Some powers',
        otherAuthorities: 'Some authorities',
        projectBackground: 'Some background',
        publicRegister: 'Public Register Info',
        siteDetails: [
          { ...mockCircleSite, activityDetails: completedActivityDetails }
        ]
      }

      expect(createTaskList(marineLicence).siteDetails).toBe(COMPLETED)
    })

    it('should return siteDetails as IN_PROGRESS when circle fields are present but activity details are missing', () => {
      const marineLicence = {
        siteDetails: [{ ...mockCircleSite, activityDetails: null }]
      }

      expect(createTaskList(marineLicence).siteDetails).toBe(IN_PROGRESS)
    })

    it('should return siteDetails as IN_PROGRESS when circleWidth is missing', () => {
      const siteWithoutCircleWidth = { ...mockCircleSite }
      delete siteWithoutCircleWidth.circleWidth

      const marineLicence = {
        siteDetails: [
          {
            ...siteWithoutCircleWidth,
            activityDetails: completedActivityDetails
          }
        ]
      }

      expect(createTaskList(marineLicence).siteDetails).toBe(IN_PROGRESS)
    })

    it('should return siteDetails as INCOMPLETE when coordinatesEntry is unknown', () => {
      const marineLicence = {
        siteDetails: [
          {
            ...mockCircleSite,
            coordinatesEntry: 'unknown',
            activityDetails: completedActivityDetails
          }
        ]
      }

      expect(createTaskList(marineLicence).siteDetails).toBe(INCOMPLETE)
    })
  })

  describe('multiple coordinate site (coordinatesType=coordinates, coordinatesEntry=multiple)', () => {
    it('should return siteDetails as COMPLETED when all fields, valid coordinates, and activity details are present', () => {
      const marineLicence = {
        siteDetails: [
          { ...mockMultipleSite, activityDetails: completedActivityDetails }
        ]
      }

      expect(createTaskList(marineLicence).siteDetails).toBe(COMPLETED)
    })

    it('should return siteDetails as INCOMPLETE when no fields are present', () => {
      const marineLicence = {
        siteDetails: [
          {
            coordinatesType: 'coordinates',
            coordinatesEntry: 'multiple'
          }
        ]
      }

      expect(createTaskList(marineLicence).siteDetails).toBe(INCOMPLETE)
    })

    it('should return siteDetails as IN_PROGRESS when some required fields are missing', () => {
      const siteWithoutSiteName = { ...mockMultipleSite }
      delete siteWithoutSiteName.siteName

      const marineLicence = {
        siteDetails: [
          { ...siteWithoutSiteName, activityDetails: completedActivityDetails }
        ]
      }

      expect(createTaskList(marineLicence).siteDetails).toBe(IN_PROGRESS)
    })

    it('should return siteDetails as IN_PROGRESS when coordinates array has fewer than 3 points', () => {
      const marineLicence = {
        siteDetails: [
          {
            ...mockMultipleSite,
            coordinates: [
              { latitude: '51.5', longitude: '-0.1' },
              { latitude: '51.6', longitude: '-0.2' }
            ],
            activityDetails: completedActivityDetails
          }
        ]
      }

      expect(createTaskList(marineLicence).siteDetails).toBe(IN_PROGRESS)
    })

    it('should return siteDetails as IN_PROGRESS when activity details are missing', () => {
      const marineLicence = {
        siteDetails: [{ ...mockMultipleSite, activityDetails: null }]
      }

      expect(createTaskList(marineLicence).siteDetails).toBe(IN_PROGRESS)
    })

    it('should return siteDetails as IN_PROGRESS when activity details are incomplete', () => {
      const marineLicence = {
        siteDetails: [
          {
            ...mockMultipleSite,
            activityDetails: [
              { ...completedActivityDetails[0], workingHours: '' }
            ]
          }
        ]
      }

      expect(createTaskList(marineLicence).siteDetails).toBe(IN_PROGRESS)
    })
  })

  it('should return all tasks as INCOMPLETE when marineLicence has no properties', () => {
    expect(createTaskList({})).toEqual({
      projectName: INCOMPLETE,
      specialLegalPowers: INCOMPLETE,
      otherAuthorities: INCOMPLETE,
      projectBackground: INCOMPLETE,
      publicRegister: INCOMPLETE,
      publicConsultation: INCOMPLETE,
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
      publicConsultation: {
        consulted: 'yes',
        details: 'Public consultation details'
      },
      siteDetails: [mockFileUploadSite]
    }

    const result = createTaskList(marineLicence)

    expect(result).toEqual({
      projectName: COMPLETED,
      specialLegalPowers: COMPLETED,
      otherAuthorities: COMPLETED,
      projectBackground: COMPLETED,
      publicRegister: COMPLETED,
      publicConsultation: COMPLETED,
      siteDetails: IN_PROGRESS
    })
  })
})
