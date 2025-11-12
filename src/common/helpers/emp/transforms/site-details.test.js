import { describe, it, expect, vi } from 'vitest'
import { transformSiteDetails } from './site-details.js'
import * as manualCoordinates from './manual-coordinates.js'

vi.mock('./manual-coordinates.js', () => ({
  manualCoordsToEmpGeometry: vi.fn()
}))

describe('transformSiteDetails', () => {
  it('returns empty array for rings when siteDetails contains file upload coordinates', () => {
    const siteDetails = [
      {
        coordinatesType: 'file',
        fileUploadType: 'kml',
        geoJSON: { type: 'FeatureCollection', features: [] }
      }
    ]

    const result = transformSiteDetails(siteDetails)

    expect(result).toEqual({
      rings: [],
      spatialReference: {
        wkid: 4326
      }
    })
    expect(manualCoordinates.manualCoordsToEmpGeometry).not.toHaveBeenCalled()
  })

  it('calls manualCoordsToEmpGeometry when siteDetails has manual coordinates', () => {
    const siteDetails = [
      {
        coordinatesType: 'coordinates',
        coordinateSystem: 'wgs84',
        coordinates: { latitude: '50.0', longitude: '-1.0' }
      },
      {
        coordinatesType: 'coordinates',
        coordinateSystem: 'osgb36',
        coordinates: { eastings: '400000', northings: '200000' }
      }
    ]

    const mockGeometry = [
      [
        [-1.0, 50.0],
        [-1.0, 50.0]
      ]
    ]
    manualCoordinates.manualCoordsToEmpGeometry.mockReturnValue(mockGeometry)

    const result = transformSiteDetails(siteDetails)

    expect(manualCoordinates.manualCoordsToEmpGeometry).toHaveBeenCalledWith(
      siteDetails
    )
    expect(result).toEqual({
      rings: mockGeometry,
      spatialReference: {
        wkid: 4326
      }
    })
  })

  it('returns empty array when siteDetails is empty', () => {
    const siteDetails = []

    transformSiteDetails(siteDetails)

    expect(manualCoordinates.manualCoordsToEmpGeometry).toHaveBeenCalledWith(
      siteDetails
    )
  })
})
