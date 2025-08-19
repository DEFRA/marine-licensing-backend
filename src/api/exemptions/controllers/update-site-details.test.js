import { ObjectId } from 'mongodb'
import { updateSiteDetailsController } from './update-site-details.js'
import Boom from '@hapi/boom'
import { mockMultipleSiteDetails } from '../../../models/site-details/test-fixtures.js'

describe('PATCH /exemptions/site-details', () => {
  const payloadValidator = updateSiteDetailsController.options.validate.payload
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  it('should fail if siteDetails are missing', () => {
    const result = payloadValidator.validate({})

    expect(result.error.message).toContain('SITE_DETAILS_REQUIRED')
  })

  it('should update exemption with site details', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      multipleSiteDetails: mockMultipleSiteDetails,
      siteDetails: {
        coordinatesType: 'coordinates',
        coordinatesEntry: 'single',
        coordinateSystem: 'wgs84',
        coordinates: { latitude: '51.489676', longitude: '-0.231530' },
        circleWidth: '20'
      },
      ...mockAuditPayload
    }

    const mockUpdateOne = jest.fn().mockResolvedValueOnce({})
    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        updateOne: mockUpdateOne
      }
    })

    await updateSiteDetailsController.handler(
      {
        db: mockMongo,
        payload: mockPayload
      },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith({
      message: 'success'
    })

    expect(mockMongo.collection).toHaveBeenCalledWith('exemptions')
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(mockPayload.id) },
      {
        $set: {
          multipleSiteDetails: mockPayload.multipleSiteDetails,
          siteDetails: mockPayload.siteDetails,
          ...mockAuditPayload
        }
      }
    )
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      multipleSiteDetails: mockMultipleSiteDetails,
      siteDetails: {
        coordinatesType: 'coordinates',
        coordinatesEntry: 'single',
        coordinateSystem: 'wgs84',
        coordinates: { latitude: '51.489676', longitude: '-0.231530' },
        circleWidth: '20'
      },
      ...mockAuditPayload
    }

    const mockError = 'Database failed'

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        updateOne: jest.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    expect(() =>
      updateSiteDetailsController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow(`Error updating site details: ${mockError}`)
  })

  it('should return a  404 if id is not correct', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      multipleSiteDetails: mockMultipleSiteDetails,
      siteDetails: {
        coordinatesType: 'coordinates',
        coordinatesEntry: 'single',
        coordinateSystem: 'wgs84',
        coordinates: { latitude: '51.489676', longitude: '-0.231530' },
        circleWidth: '20'
      },
      ...mockAuditPayload
    }

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        updateOne: jest.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }
    })

    jest.spyOn(Boom, 'notFound')

    expect(() =>
      updateSiteDetailsController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow(`Exemption not found`)
  })
})
