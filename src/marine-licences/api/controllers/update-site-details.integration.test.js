import { ObjectId } from 'mongodb'
import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { mockFileUploadSite } from '../../../../tests/test.fixture.js'
import { mockMarineLicence } from '../../models/test-fixtures.js'
import { createActivityDetails } from '../helpers/create-empty-activity-details.js'

describe('PATCH /marine-licence/site-details - payload size limits', async () => {
  const getServer = await setupTestServer()
  const tenMegaBytes = 10 * 1000 * 1000
  const existingActivityDetails = [createActivityDetails()]

  const mockCredentials = {
    contactId: '123e4567-e89b-12d3-a456-426614174000'
  }

  it('should reject payload 1 byte over the 10MB threshold', async () => {
    const oversizedString = 'x'.repeat(tenMegaBytes + 1)

    const response = await getServer().inject({
      method: 'PATCH',
      url: '/marine-licence/site-details',
      payload: oversizedString,
      headers: {
        'content-type': 'text/plain'
      },
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    expect(response.statusCode).toBe(413)
    const payload = JSON.parse(response.payload)
    expect(payload.message).toContain(
      'Payload content length greater than maximum allowed'
    )
  })

  it('should accept payload exactly at the 10MB threshold', async () => {
    const exactString = 'x'.repeat(tenMegaBytes)

    const response = await getServer().inject({
      method: 'PATCH',
      url: '/marine-licence/site-details',
      payload: exactString,
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    expect(response.statusCode).not.toBe(413) // will fail validation - only after boundary checking
  })

  it('should accept payload 1 byte below the 10MB threshold', async () => {
    const undersizedString = 'x'.repeat(tenMegaBytes - 1)

    const response = await getServer().inject({
      method: 'PATCH',
      url: '/marine-licence/site-details',
      payload: undersizedString,
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    // will fail validation - only after boundary checking
    expect(response.statusCode).not.toBe(413)
  })

  it('should automatically update site and preserve activity details', async () => {
    const marineLicenceId = new ObjectId()

    const mockFileUploadSiteWithActivityDetails = {
      ...mockFileUploadSite,
      activityDetails: [
        {
          activityType: 'construction',
          activitySubType: 'some-sub-type',
          activityDescription: 'Test description',
          activityDuration: '',
          completionDate: '',
          activityMonths: '',
          workingHours: ''
        }
      ]
    }

    const marineLicence = {
      ...mockMarineLicence,
      _id: marineLicenceId,
      contactId: mockCredentials.contactId,
      siteDetails: {
        coordinatesType: 'file'
      }
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/site-details',
      contactId: mockCredentials.contactId,
      payload: {
        id: marineLicenceId.toString(),
        siteDetails: [mockFileUploadSiteWithActivityDetails]
      }
    })

    expect(statusCode).toBe(200)

    const updated = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: marineLicenceId })

    expect(updated.siteDetails[0].activityDetails.length).toEqual(1)
    expect(updated.siteDetails[0].activityDetails[0].activityType).toEqual(
      'construction'
    )
  })

  it('should automatically update site details and populate activity details', async () => {
    const marineLicenceId = new ObjectId()

    const mockFileUploadSiteWithoutActivityDetails = { ...mockFileUploadSite }
    delete mockFileUploadSiteWithoutActivityDetails.activityDetails

    const marineLicence = {
      ...mockMarineLicence,
      _id: marineLicenceId,
      contactId: mockCredentials.contactId,
      siteDetails: [
        {
          coordinatesType: 'file'
        }
      ]
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/site-details',
      contactId: mockCredentials.contactId,
      payload: {
        id: marineLicenceId.toString(),
        siteDetails: [mockFileUploadSiteWithoutActivityDetails]
      }
    })

    expect(statusCode).toBe(200)

    const updated = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: marineLicenceId })

    expect(updated.siteDetails[0].activityDetails).toEqual(
      existingActivityDetails
    )
  })
})
