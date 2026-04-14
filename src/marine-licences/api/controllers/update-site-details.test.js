import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updateSiteDetailsController } from './update-site-details.js'
import Boom from '@hapi/boom'
import { mockFileUploadSite } from '../../../../tests/test.fixture.js'

describe('PATCH /marine-licences/site-details', () => {
  const payloadValidator = updateSiteDetailsController.options.validate.payload
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  it('should fail if siteDetails are missing', () => {
    const result = payloadValidator.validate({})
    expect(result.error.message).toContain('SITE_DETAILS_REQUIRED')
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      siteDetails: [mockFileUploadSite],
      ...mockAuditPayload
    }

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
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
      siteDetails: [mockFileUploadSite],
      ...mockAuditPayload
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }
    })

    vi.spyOn(Boom, 'notFound')

    await expect(() =>
      updateSiteDetailsController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow(`Marine licence not found`)
  })
})
