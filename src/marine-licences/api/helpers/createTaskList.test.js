import { createTaskList } from './createTaskList'
import {
  INCOMPLETE,
  IN_PROGRESS,
  COMPLETED,
  NOT_ACCEPTED
} from '../../../shared/helpers/task-list-utils.js'
import {
  mockFileUploadSite,
  mockCircleSite,
  mockMultipleSite,
  mockWaterFrameworkDirective,
  createCompleteMarineLicence
} from '../../../../tests/test.fixture.js'
import { createActivityDetails } from './create-empty-activity-details.js'

const mockWaterFrameworkDirectiveWithNoNauticalMile = { nauticalMile: 'no' }

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

const mockMarineLicence = createCompleteMarineLicence()

const { feeEstimate, harbourAuthority } = mockMarineLicence

const mockCompleteSite = {
  ...mockFileUploadSite,
  activityDetails: completedActivityDetails
}

describe('createTaskList', () => {
  it('should mark siteDetails as COMPLETED when all site and activity fields are present', () => {
    const marineLicence = {
      feeEstimate,
      harbourAuthority,
      projectName: 'Test Project',
      siteDetails: [mockCompleteSite],
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      preferredDates: {
        start: { month: '01', year: '2026' },
        end: { month: '12', year: '2026' }
      },
      projectBackground: 'Some background',
      publicRegister: 'Public Register Info',
      publicConsultation: {
        consulted: 'yes',
        details: 'Public consultation details'
      },
      waterFrameworkDirective: mockWaterFrameworkDirectiveWithNoNauticalMile
    }

    expect(createTaskList(marineLicence)).toEqual({
      feeEstimate: COMPLETED,
      harbourAuthority: COMPLETED,
      projectName: COMPLETED,
      siteDetails: COMPLETED,
      specialLegalPowers: COMPLETED,
      otherAuthorities: COMPLETED,
      preferredDates: COMPLETED,
      projectBackground: COMPLETED,
      publicConsultation: COMPLETED,
      publicRegister: COMPLETED,
      waterFrameworkDirective: COMPLETED,
      marinePlanPolicies: INCOMPLETE
    })
  })

  it('should not include specialLegalPowers for citizens', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      projectBackground: 'Some background',
      siteDetails: [mockFileUploadSite],
      preferredDates: {
        start: { month: '01', year: '2026' },
        end: { month: '12', year: '2026' }
      },
      publicRegister: 'Public Register Info',
      publicConsultation: {
        consulted: 'yes',
        details: 'Public consultation details'
      },
      feeEstimate,
      harbourAuthority,
      waterFrameworkDirective: mockWaterFrameworkDirectiveWithNoNauticalMile
    }

    expect(createTaskList(marineLicence, true)).toEqual({
      feeEstimate: COMPLETED,
      harbourAuthority: COMPLETED,
      projectName: COMPLETED,
      publicRegister: COMPLETED,
      siteDetails: IN_PROGRESS,
      otherAuthorities: COMPLETED,
      preferredDates: COMPLETED,
      projectBackground: COMPLETED,
      publicConsultation: COMPLETED,
      waterFrameworkDirective: COMPLETED,
      marinePlanPolicies: INCOMPLETE
    })
  })

  it('should return siteDetails as IN_PROGRESS when a site field is missing', () => {
    const siteWithoutSiteName = { ...mockCompleteSite }
    delete siteWithoutSiteName.siteName

    const marineLicence = {
      feeEstimate,
      harbourAuthority,
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      siteDetails: [siteWithoutSiteName],
      projectBackground: 'Test project background',
      preferredDates: {
        start: { month: '01', year: '2026' },
        end: { month: '12', year: '2026' }
      },
      waterFrameworkDirective: mockWaterFrameworkDirectiveWithNoNauticalMile
    }

    expect(createTaskList(marineLicence)).toEqual({
      feeEstimate: COMPLETED,
      harbourAuthority: COMPLETED,
      projectName: COMPLETED,
      siteDetails: IN_PROGRESS,
      specialLegalPowers: COMPLETED,
      otherAuthorities: COMPLETED,
      preferredDates: COMPLETED,
      projectBackground: COMPLETED,
      publicConsultation: INCOMPLETE,
      publicRegister: INCOMPLETE,
      waterFrameworkDirective: COMPLETED,
      marinePlanPolicies: INCOMPLETE
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

  it('should correctly set waterFrameworkDirective to INCOMPLETE when fields are missing', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      siteDetails: [
        {
          ...mockFileUploadSite,
          activityDetails: null
        }
      ],
      waterFrameworkDirective: { nauticalMile: 'yes' }
    }

    expect(createTaskList(marineLicence).waterFrameworkDirective).toBe(
      INCOMPLETE
    )
  })

  it('should correctly set waterFrameworkDirective to COMPLETE when fields are not missing', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'Some powers',
      otherAuthorities: 'Some authorities',
      siteDetails: [
        {
          ...mockFileUploadSite,
          activityDetails: null
        }
      ],
      waterFrameworkDirective: mockWaterFrameworkDirective
    }

    expect(createTaskList(marineLicence).waterFrameworkDirective).toBe(
      COMPLETED
    )
  })

  it('should set waterFrameworkDirective to COMPLETED when nauticalMile is yes and excludedActivities is yes', () => {
    const marineLicence = {
      siteDetails: [{ ...mockFileUploadSite, activityDetails: null }],
      waterFrameworkDirective: {
        nauticalMile: 'yes',
        excludedActivities: 'yes'
      }
    }

    expect(createTaskList(marineLicence).waterFrameworkDirective).toBe(
      COMPLETED
    )
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

  describe('feeEstimate', () => {
    it('should return INCOMPLETE when feeEstimate is missing', () => {
      expect(createTaskList({}).feeEstimate).toBe(INCOMPLETE)
    })

    it('should return NOT_ACCEPTED when accept is no', () => {
      const marineLicence = { feeEstimate: { accept: 'no' } }
      expect(createTaskList(marineLicence).feeEstimate).toBe(NOT_ACCEPTED)
    })

    it('should return COMPLETED when accept is yes', () => {
      const marineLicence = {
        feeEstimate: { accept: 'yes', termsAndConditions: true }
      }
      expect(createTaskList(marineLicence).feeEstimate).toBe(COMPLETED)
    })
  })

  it('should return all tasks as INCOMPLETE when marineLicence has no properties', () => {
    expect(createTaskList({})).toEqual({
      feeEstimate: INCOMPLETE,
      harbourAuthority: INCOMPLETE,
      projectName: INCOMPLETE,
      specialLegalPowers: INCOMPLETE,
      otherAuthorities: INCOMPLETE,
      preferredDates: INCOMPLETE,
      projectBackground: INCOMPLETE,
      publicRegister: INCOMPLETE,
      publicConsultation: INCOMPLETE,
      siteDetails: INCOMPLETE,
      waterFrameworkDirective: INCOMPLETE,
      marinePlanPolicies: INCOMPLETE
    })
  })

  it('should mark tasks as COMPLETED when all required properties are present', () => {
    const marineLicence = {
      projectName: 'Test Project',
      specialLegalPowers: 'some powers',
      publicRegister: 'Public Register Info',
      otherAuthorities: 'Some authorities',
      preferredDates: {
        start: { month: '01', year: '2026' },
        end: { month: '12', year: '2026' }
      },
      projectBackground: 'Some background',
      publicConsultation: {
        consulted: 'yes',
        details: 'Public consultation details'
      },
      feeEstimate,
      harbourAuthority,
      siteDetails: [mockFileUploadSite],
      waterFrameworkDirective: mockWaterFrameworkDirectiveWithNoNauticalMile
    }

    const result = createTaskList(marineLicence)

    expect(result).toEqual({
      feeEstimate: COMPLETED,
      harbourAuthority: COMPLETED,
      projectName: COMPLETED,
      specialLegalPowers: COMPLETED,
      otherAuthorities: COMPLETED,
      preferredDates: COMPLETED,
      projectBackground: COMPLETED,
      publicRegister: COMPLETED,
      publicConsultation: COMPLETED,
      siteDetails: IN_PROGRESS,
      waterFrameworkDirective: COMPLETED,
      marinePlanPolicies: INCOMPLETE
    })
  })

  describe('marinePlanPolicies status', () => {
    const statusFor = (overrides) =>
      createTaskList(overrides).marinePlanPolicies

    it('is INCOMPLETE before the ArcGIS policy query has completed', () => {
      expect(statusFor({ marinePlanPolicyJob: null })).toBe(INCOMPLETE)
      expect(statusFor({ marinePlanPolicyJob: 'pending' })).toBe(INCOMPLETE)
      expect(statusFor({ marinePlanPolicyJob: 'computing' })).toBe(INCOMPLETE)
      expect(statusFor({ marinePlanPolicyJob: 'failed' })).toBe(INCOMPLETE)
    })

    it('is COMPLETED when the query is ready and no policies apply', () => {
      expect(
        statusFor({ marinePlanPolicyJob: 'ready', marinePlanPolicies: [] })
      ).toBe(COMPLETED)
    })

    it('is INCOMPLETE when ready with policies but none answered', () => {
      expect(
        statusFor({
          marinePlanPolicyJob: 'ready',
          marinePlanPolicies: [{ policyCode: 'A' }, { policyCode: 'B' }],
          marinePlanPolicyResponses: {}
        })
      ).toBe(INCOMPLETE)
    })

    it('is IN_PROGRESS when ready with some but not all policies answered', () => {
      expect(
        statusFor({
          marinePlanPolicyJob: 'ready',
          marinePlanPolicies: [{ policyCode: 'A' }, { policyCode: 'B' }],
          marinePlanPolicyResponses: { A: 'An answer' }
        })
      ).toBe(IN_PROGRESS)
    })

    it('is COMPLETED when ready with every policy answered', () => {
      expect(
        statusFor({
          marinePlanPolicyJob: 'ready',
          marinePlanPolicies: [{ policyCode: 'A' }, { policyCode: 'B' }],
          marinePlanPolicyResponses: { A: 'a', B: 'b' }
        })
      ).toBe(COMPLETED)
    })

    it('ignores stale responses for policies that no longer apply after a site change', () => {
      expect(
        statusFor({
          marinePlanPolicyJob: 'ready',
          marinePlanPolicies: [{ policyCode: 'B' }],
          marinePlanPolicyResponses: { A: 'stale answer' }
        })
      ).toBe(INCOMPLETE)
    })

    it('treats a whitespace-only response as unanswered', () => {
      expect(
        statusFor({
          marinePlanPolicyJob: 'ready',
          marinePlanPolicies: [{ policyCode: 'A' }],
          marinePlanPolicyResponses: { A: '   ' }
        })
      ).toBe(INCOMPLETE)
    })
  })
})
