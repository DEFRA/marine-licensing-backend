import { ObjectId } from 'mongodb'
import { EXEMPTION_STATUS } from '../src/exemptions/constants/exemption.js'
import { MARINE_LICENCE_STATUS } from '../src/marine-licences/constants/marine-licence.js'
import { COORDINATE_SYSTEMS } from '../src/shared/common/constants/coordinates.js'
import { createActivityDetails } from '../src/marine-licences/api/helpers/create-empty-activity-details.js'

export const mockCredentials = {
  contactId: '123e4567-e89b-12d3-a456-426614174000'
}

export const createCompleteExemption = (overrides = {}) => {
  const exemptionId = overrides._id || new ObjectId()
  const contactId =
    overrides.contactId || '123e4567-e89b-12d3-a456-426614174000'

  return {
    _id: exemptionId,
    contactId,
    organisation: {
      name: 'Test Organisation Ltd',
      id: 'org-123'
    },
    projectName: 'Test Marine Project',
    publicRegister: {
      consent: 'yes'
    },
    multipleSiteDetails: {
      multipleSitesEnabled: false
    },
    siteDetails: [
      {
        coordinatesType: 'coordinates',
        coordinatesEntry: 'single',
        coordinateSystem: COORDINATE_SYSTEMS.WGS84,
        coordinates: {
          latitude: '51.489676',
          longitude: '-0.231530'
        },
        circleWidth: '20',
        activityDates: {
          start: new Date('2027-01-01'),
          end: new Date('2027-12-31')
        },
        activityDescription: 'Test activity description'
      }
    ],
    status: EXEMPTION_STATUS.DRAFT,
    createdAt: new Date('2026-12-01'),
    updatedAt: new Date('2026-12-01'),
    ...overrides
  }
}

const testLatitude = 51.474968
const testLongitude = 1.076016

export const mockFileUploadSite = {
  coordinatesType: 'file',
  fileUploadType: 'kml',
  siteName: 'site 1',
  geoJSON: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [testLongitude, testLatitude]
        },
        properties: {}
      }
    ]
  },
  featureCount: 1,
  uploadedFile: {
    filename: 'test-site.kml'
  },
  s3Location: {
    s3Bucket: 'mmo-uploads',
    s3Key: 'test-file-key',
    checksumSha256: 'test-checksum'
  },
  activityDetails: [createActivityDetails()]
}

export const mockCircleSite = {
  coordinatesType: 'coordinates',
  coordinatesEntry: 'single',
  coordinateSystem: 'wgs84',
  siteName: 'circle site 1',
  coordinates: { latitude: '51.5', longitude: '-0.1' },
  circleWidth: 100
}

export const mockMultipleSite = {
  coordinatesType: 'coordinates',
  coordinatesEntry: 'multiple',
  coordinateSystem: 'wgs84',
  siteName: 'multiple site 1',
  coordinates: [
    { latitude: '51.5', longitude: '-0.1' },
    { latitude: '51.6', longitude: '-0.2' },
    { latitude: '51.7', longitude: '-0.3' }
  ]
}

export const mockWaterFrameworkDirective = {
  nauticalMile: 'yes',
  excludedActivities: 'no',
  uploadedFile: {
    filename: 'Suffolk MMO shapefiles.zip'
  },
  s3Location: {
    s3Bucket: 'mmo-uploads',
    s3Key:
      'exemptions/697ff02d-e5e7-4e42-ba47-c36fc116af47/45265950-72fb-4bb7-ab1c-2fb722ab15ec',
    checksumSha256: 'V3nR8yISvb6pfVp1g1eUdFo5Cer80JpGlqkGAJb/O8k='
  }
}

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

export const mockCompleteSite = {
  ...mockFileUploadSite,
  activityDetails: completedActivityDetails
}

export const mockUkInvoicingAddress = {
  addressLine1: '123 Example Street',
  addressLine2: 'Flat 2',
  addressTown: 'Example town',
  addressCounty: 'Example country',
  addressPostcode: 'AA1 1AA'
}

export const mockInvoicing = {
  invoiceAddressType: 'uk',
  invoiceAddress: mockUkInvoicingAddress
}

export const createCompleteMarineLicence = (overrides = {}) => {
  const marineLicenceId = overrides._id || new ObjectId()
  const contactId =
    overrides.contactId || '123e4567-e89b-12d3-a456-426614174000'

  return {
    _id: marineLicenceId,
    contactId,
    feeEstimate: { accept: 'yes', termsAndConditions: true, feeBand: '2A' },
    invoicing: mockInvoicing,
    projectName: 'Test Marine Licence Project',
    projectBackground: 'Test project background',
    otherAuthorities: {
      agree: 'yes',
      details: 'Test other authorities details'
    },
    specialLegalPowers: {
      agree: 'yes',
      details: 'Test special legal powers details'
    },
    harbourAuthority: {
      area: 'yes',
      details: 'Harbour authority details'
    },
    publicRegister: {
      consent: 'no',
      reason: 'Test public register details'
    },
    preferredDates: {
      start: { month: '01', year: '2027' },
      end: { month: '12', year: '2027' }
    },
    publicConsultation: {
      consulted: 'yes',
      details: 'Public consultation details'
    },
    status: MARINE_LICENCE_STATUS.DRAFT,
    createdAt: new Date('2026-12-01'),
    updatedAt: new Date('2026-12-01'),
    siteDetails: [mockCompleteSite],
    siteDetailsConfirmed: true,
    waterFrameworkDirective: mockWaterFrameworkDirective,
    ...overrides
  }
}
