import { MARINE_LICENCE_STATUS } from '../constants/marine-licence.js'
import { ObjectId } from 'mongodb'

export const mockMarineLicence = {
  _id: new ObjectId(),
  contactId: 'contact-123-abc',
  projectName: 'Test Marine Licence Project',
  status: MARINE_LICENCE_STATUS.DRAFT,
  createdAt: new Date('2026-12-01'),
  updatedAt: new Date('2026-12-01')
}

const testLatitude = 51.474968
const testLongitude = 1.076016

export const mockMarineLicenceFileUploadSiteDetails = [
  {
    coordinatesType: 'file',
    fileUploadType: 'kml',
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
    }
  }
]
