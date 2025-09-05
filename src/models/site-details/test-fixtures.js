import { ObjectId } from 'mongodb'
import { COORDINATE_SYSTEMS } from '../../common/constants/coordinates.js'

const mockId = new ObjectId().toHexString()

export const mockMultipleSiteDetails = {
  multipleSitesEnabled: true,
  sameActivityDates: 'yes'
}

export const mockMultipleSiteDetailsDisabled = {
  multipleSitesEnabled: false
}

const activityDates = {
  start: new Date('2027-01-01'),
  end: new Date('2027-12-31')
}

const activityDescription = 'test description'

export const mockSiteDetails = {
  activityDates,
  activityDescription,
  coordinatesType: 'coordinates',
  coordinatesEntry: 'single',
  coordinateSystem: COORDINATE_SYSTEMS.WGS84,
  coordinates: { latitude: '51.489676', longitude: '-0.231530' },
  circleWidth: '20'
}

export const mockSiteDetailsWithMultiSite = {
  ...mockSiteDetails,
  siteName: 'Test Site Name'
}

delete mockSiteDetailsWithMultiSite.activityDescription

export const mockSiteDetailsRequest = {
  id: mockId,
  multipleSiteDetails: mockMultipleSiteDetailsDisabled,
  siteDetails: mockSiteDetails
}

export const mockSiteDetailsRequestWithMultiSite = {
  id: mockId,
  multipleSiteDetails: mockMultipleSiteDetails,
  siteDetails: mockSiteDetailsWithMultiSite
}

const testLatitude = 51.474968
const testLongitude = 1.076016
export const mockFileUploadSiteDetails = {
  coordinatesType: 'file',
  fileUploadType: 'kml',
  geoJSON: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [testLatitude, testLongitude]
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
  }
}

export const mockFileUploadSiteDetailsRequest = {
  id: mockId,
  siteDetails: mockFileUploadSiteDetails
}

export const mockWgs84MultipleCoordinates = {
  activityDates,
  activityDescription,
  coordinatesType: 'coordinates',
  coordinatesEntry: 'multiple',
  coordinateSystem: COORDINATE_SYSTEMS.WGS84,
  coordinates: [
    {
      latitude: '54.088594',
      longitude: '-0.178408'
    },
    {
      latitude: '54.086782',
      longitude: '-0.177369'
    },
    {
      latitude: '54.088057',
      longitude: '-0.175219'
    }
  ]
}

export const mockOsgb36MultipleCoordinates = {
  activityDates,
  activityDescription,
  coordinatesType: 'coordinates',
  coordinatesEntry: 'multiple',
  coordinateSystem: COORDINATE_SYSTEMS.OSGB36,
  coordinates: [
    {
      eastings: '513967',
      northings: '476895'
    },
    {
      eastings: '514040',
      northings: '476693'
    },
    {
      eastings: '514193',
      northings: '476835'
    }
  ]
}

export const mockWgs84MultipleCoordinatesRequest = {
  id: mockId,
  multipleSiteDetails: mockMultipleSiteDetailsDisabled,
  siteDetails: mockWgs84MultipleCoordinates
}

export const mockOsgb36MultipleCoordinatesRequest = {
  id: mockId,
  multipleSiteDetails: mockMultipleSiteDetailsDisabled,
  siteDetails: mockOsgb36MultipleCoordinates
}

export { mockId }
