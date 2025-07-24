import { ObjectId } from 'mongodb'
import { COORDINATE_SYSTEMS } from '../../common/constants/coordinates.js'

const mockId = new ObjectId().toHexString()

export const mockSiteDetails = {
  coordinatesType: 'coordinates',
  coordinatesEntry: 'single',
  coordinateSystem: COORDINATE_SYSTEMS.WGS84,
  coordinates: { latitude: '51.489676', longitude: '-0.231530' },
  circleWidth: '20'
}

export const mockSiteDetailsRequest = {
  id: mockId,
  siteDetails: mockSiteDetails
}

const testCoordinates = [-0.1, 51.5]

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
          coordinates: testCoordinates
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

export { mockId }
