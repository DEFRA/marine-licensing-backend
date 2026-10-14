import {
  marineLicenceGatewayResponseSchema,
  wfdDocumentDownloadUrlResponseSchema
} from './gateway-responses.js'

const validResponse = {
  projectName: 'Harbour dredging',
  projectBackground: null,
  preferredLicenceDates: 'August 2026 to November 2026',
  publicRegister: { withholdConsent: 'no' },
  specialLegalPowers: null,
  harbourAuthority: null,
  otherAuthorities: null,
  publicConsultation: null,
  waterFrameworkDirective: {
    nauticalMile: 'yes',
    excludedActivities: 'no',
    documentUrl: null,
    fileName: null
  },
  sites: [
    {
      siteIndex: 0,
      siteName: 'Site 1',
      locationMethod: 'Manual coordinate entry',
      coordinatesEntry:
        'Enter a single set of coordinates and a width for a circle',
      coordinateSystem: 'WGS84 (World Geodetic System 1984)',
      uploadedFile: null,
      circleWidthMetres: 20,
      geometry: null,
      activities: [
        {
          activityIndex: 0,
          activityType: 'Dredging',
          activitySubType: null,
          subActivities: [],
          otherActivity: null,
          activityDescription: 'Maintenance dredge',
          activityDuration: '1 year',
          activityMonths: { applicable: null, details: null },
          completionDate: { hasSpecificDate: null, reason: null },
          workingHours: null
        }
      ]
    }
  ],
  marinePlanPolicies: [
    {
      policyCode: 'E-AGG-3',
      policyInformation: '<p>x</p>',
      applicantAnswer: 'test'
    }
  ],
  withdrawnAt: new Date('2026-09-15T10:30:00.000Z')
}

describe('marineLicenceGatewayResponseSchema', () => {
  test('accepts a complete gateway response', () => {
    expect(
      marineLicenceGatewayResponseSchema.validate(validResponse).error
    ).toBeUndefined()
  })

  test('rejects a response without sites', () => {
    const { sites: _sites, ...withoutSites } = validResponse

    expect(
      marineLicenceGatewayResponseSchema.validate(withoutSites).error
    ).toBeDefined()
  })
})

describe('wfdDocumentDownloadUrlResponseSchema', () => {
  test('accepts a download URL response', () => {
    expect(
      wfdDocumentDownloadUrlResponseSchema.validate({
        message: 'success',
        value: { url: 'https://s3.example.com/key', expiresIn: 3600 }
      }).error
    ).toBeUndefined()
  })

  test('rejects a response without a url', () => {
    expect(
      wfdDocumentDownloadUrlResponseSchema.validate({
        message: 'success',
        value: { expiresIn: 3600 }
      }).error
    ).toBeDefined()
  })
})
