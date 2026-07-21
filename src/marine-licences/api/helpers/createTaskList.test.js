import { createTaskList, getSiteDetailsDataStatus } from './createTaskList'
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
  mockInvoicing,
  mockUkInvoicingAddress,
  mockInvoiceContactDetails,
  createCompleteMarineLicence
} from '../../../../tests/test.fixture.js'
import { createActivityDetails } from './create-empty-activity-details.js'
import { INVOICE_TYPE_OPTIONS } from '../../constants/invoicing.js'

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
  it('should mark siteDetails as COMPLETED when all site and activity fields are present and confirmed', () => {
    const marineLicence = {
      feeEstimate,
      harbourAuthority,
      projectName: 'Test Project',
      siteDetails: [mockCompleteSite],
      siteDetailsConfirmed: true,
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
      marinePlanPolicies: INCOMPLETE,
      invoicing: INCOMPLETE
    })
  })

  it('should mark siteDetails as IN_PROGRESS when all site and activity fields are present but not confirmed', () => {
    const marineLicence = {
      feeEstimate,
      harbourAuthority,
      projectName: 'Test Project',
      siteDetails: [mockCompleteSite],
      siteDetailsConfirmed: false,
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

    expect(createTaskList(marineLicence).siteDetails).toBe(IN_PROGRESS)
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
      marinePlanPolicies: INCOMPLETE,
      invoicing: INCOMPLETE
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
      marinePlanPolicies: INCOMPLETE,
      invoicing: INCOMPLETE
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
    it('should return siteDetails as COMPLETED when all circle fields and activity details are present and confirmed', () => {
      const marineLicence = {
        projectName: 'Test Project',
        specialLegalPowers: 'Some powers',
        otherAuthorities: 'Some authorities',
        projectBackground: 'Some background',
        publicRegister: 'Public Register Info',
        siteDetails: [
          { ...mockCircleSite, activityDetails: completedActivityDetails }
        ],
        siteDetailsConfirmed: true
      }

      expect(createTaskList(marineLicence).siteDetails).toBe(COMPLETED)
    })

    it('should return siteDetails as IN_PROGRESS when all circle fields and activity details are present but not confirmed', () => {
      const marineLicence = {
        siteDetails: [
          { ...mockCircleSite, activityDetails: completedActivityDetails }
        ]
      }

      expect(createTaskList(marineLicence).siteDetails).toBe(IN_PROGRESS)
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
    it('should return siteDetails as COMPLETED when all fields, valid coordinates, and activity details are present and confirmed', () => {
      const marineLicence = {
        siteDetails: [
          { ...mockMultipleSite, activityDetails: completedActivityDetails }
        ],
        siteDetailsConfirmed: true
      }

      expect(createTaskList(marineLicence).siteDetails).toBe(COMPLETED)
    })

    it('should return siteDetails as IN_PROGRESS when all fields, valid coordinates, and activity details are present but not confirmed', () => {
      const marineLicence = {
        siteDetails: [
          { ...mockMultipleSite, activityDetails: completedActivityDetails }
        ]
      }

      expect(createTaskList(marineLicence).siteDetails).toBe(IN_PROGRESS)
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
      marinePlanPolicies: INCOMPLETE,
      invoicing: INCOMPLETE
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
      marinePlanPolicies: INCOMPLETE,
      invoicing: INCOMPLETE
    })
  })

  describe('getSiteDetailsDataStatus', () => {
    it('returns COMPLETED for valid site data regardless of siteDetailsConfirmed', () => {
      expect(getSiteDetailsDataStatus([mockCompleteSite])).toBe(COMPLETED)
    })

    it('returns INCOMPLETE when there is no site data', () => {
      expect(getSiteDetailsDataStatus([])).toBe(INCOMPLETE)
      expect(getSiteDetailsDataStatus(undefined)).toBe(INCOMPLETE)
    })

    it('returns IN_PROGRESS when a site field is missing', () => {
      const siteWithoutSiteName = { ...mockCompleteSite }
      delete siteWithoutSiteName.siteName

      expect(getSiteDetailsDataStatus([siteWithoutSiteName])).toBe(IN_PROGRESS)
    })
  })

  describe('marinePlanPolicies status', () => {
    const statusFor = (overrides) =>
      createTaskList(overrides).marinePlanPolicies

    it.each([null, 'pending', 'computing', 'failed'])(
      'is INCOMPLETE before the ArcGIS policy query is ready (job=%s)',
      (marinePlanPolicyJob) => {
        expect(statusFor({ marinePlanPolicyJob })).toBe(INCOMPLETE)
      }
    )

    it('is COMPLETED when the query is ready and no policies apply', () => {
      expect(
        statusFor({
          marinePlanPolicyJob: 'ready',
          marinePlanPoliciesCount: 0,
          marinePlanPolicyResponseCount: 0
        })
      ).toBe(COMPLETED)
    })

    it('is INCOMPLETE when ready with policies but none answered', () => {
      expect(
        statusFor({
          marinePlanPolicyJob: 'ready',
          marinePlanPoliciesCount: 3,
          marinePlanPolicyResponseCount: 0
        })
      ).toBe(INCOMPLETE)
    })

    it('is IN_PROGRESS when ready with some but not all policies answered', () => {
      expect(
        statusFor({
          marinePlanPolicyJob: 'ready',
          marinePlanPoliciesCount: 3,
          marinePlanPolicyResponseCount: 1
        })
      ).toBe(IN_PROGRESS)
    })

    it('is COMPLETED when ready with every policy answered', () => {
      expect(
        statusFor({
          marinePlanPolicyJob: 'ready',
          marinePlanPoliciesCount: 3,
          marinePlanPolicyResponseCount: 3
        })
      ).toBe(COMPLETED)
    })
  })

  describe('invoicing status', () => {
    const statusFor = (invoicing, isCitizen = false) =>
      createTaskList({ invoicing }, isCitizen).invoicing

    it('is INCOMPLETE when invoicing is missing', () => {
      expect(createTaskList({}).invoicing).toBe(INCOMPLETE)
    })

    it('is COMPLETED for an organisation with a UK address, contact details and purchase order details', () => {
      expect(statusFor(mockInvoicing)).toBe(COMPLETED)
    })

    it('is COMPLETED for an international address with country and address present', () => {
      const invoicing = {
        ...mockInvoicing,
        invoiceAddressType: INVOICE_TYPE_OPTIONS.INTERNATIONAL,
        invoiceAddress: {
          country: 'France',
          address: '1 Rue Example, Paris'
        }
      }

      expect(statusFor(invoicing)).toBe(COMPLETED)
    })

    it('is IN_PROGRESS when invoiceAddressType is set but the address fields are missing', () => {
      const invoicing = {
        ...mockInvoicing,
        invoiceAddressType: INVOICE_TYPE_OPTIONS.UK,
        invoiceAddress: {}
      }

      expect(statusFor(invoicing)).toBe(IN_PROGRESS)
    })

    it('is IN_PROGRESS for a UK address missing required fields', () => {
      const invoicing = {
        ...mockInvoicing,
        invoiceAddress: { addressLine1: mockUkInvoicingAddress.addressLine1 }
      }

      expect(statusFor(invoicing)).toBe(IN_PROGRESS)
    })

    it('is IN_PROGRESS for an international address missing required fields', () => {
      const invoicing = {
        ...mockInvoicing,
        invoiceAddressType: INVOICE_TYPE_OPTIONS.INTERNATIONAL,
        invoiceAddress: { country: 'France' }
      }

      expect(statusFor(invoicing)).toBe(IN_PROGRESS)
    })

    it('is IN_PROGRESS when contact details are missing required fields', () => {
      const { emailAddress, ...contactDetailsWithoutEmail } =
        mockInvoiceContactDetails
      const invoicing = {
        ...mockInvoicing,
        invoiceContactDetails: contactDetailsWithoutEmail
      }

      expect(statusFor(invoicing)).toBe(IN_PROGRESS)
    })

    it('is IN_PROGRESS for an organisation missing purchaseOrderDetails', () => {
      const invoicing = {
        ...mockInvoicing,
        purchaseOrderDetails: {}
      }

      expect(statusFor(invoicing)).toBe(IN_PROGRESS)
    })

    it('is IN_PROGRESS when purchase order is required but purchaseOrderNumber is missing', () => {
      const invoicing = {
        ...mockInvoicing,
        purchaseOrderDetails: {
          requiresPurchaseOrder: 'yes'
        }
      }

      expect(statusFor(invoicing)).toBe(IN_PROGRESS)
    })

    it('does not require organisationName or purchaseOrderDetails for citizens', () => {
      const { organisationName, ...contactDetailsWithoutOrg } =
        mockInvoiceContactDetails
      const { purchaseOrderDetails, ...invoicing } = {
        ...mockInvoicing,
        invoiceContactDetails: contactDetailsWithoutOrg
      }

      expect(statusFor(invoicing, true)).toBe(COMPLETED)
    })

    it('is IN_PROGRESS for a citizen missing required contact details', () => {
      const { organisationName, phoneNumber, ...contactDetails } =
        mockInvoiceContactDetails
      const invoicing = {
        ...mockInvoicing,
        invoiceContactDetails: contactDetails
      }

      expect(statusFor(invoicing, true)).toBe(IN_PROGRESS)
    })
  })
})
