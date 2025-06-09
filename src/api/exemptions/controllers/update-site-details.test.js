import { ObjectId } from 'mongodb'
import { updateSiteDetailsController } from './update-site-details.js'
import Boom from '@hapi/boom'

describe('PATCH /exemptions/site-details', () => {
  const payloadValidator = updateSiteDetailsController.options.validate.payload

  it('should fail if siteDetails are missing', () => {
    const result = payloadValidator.validate({})

    expect(result.error.message).toContain('SITE_DETAILS_REQUIRED')
  })

  it('should update exemption with site details', async () => {
    const { mockMongo, mockHandler } = global

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        updateOne: jest.fn().mockResolvedValueOnce({})
      }
    })

    await updateSiteDetailsController.handler(
      {
        db: mockMongo,
        payload: {
          id: new ObjectId().toHexString(),
          siteDetails: {}
        }
      },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'success'
      })
    )
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global

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
          payload: {
            id: new ObjectId().toHexString(),
            siteDetails: {}
          }
        },
        mockHandler
      )
    ).rejects.toThrow(`Error updating site details: ${mockError}`)
  })

  it('should return an 404 if id is not correct', async () => {
    const { mockMongo, mockHandler } = global

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
          payload: {
            id: new ObjectId().toHexString(),
            siteDetails: {}
          }
        },
        mockHandler
      )
    ).rejects.toThrow(`Exemption not found`)
  })
})
