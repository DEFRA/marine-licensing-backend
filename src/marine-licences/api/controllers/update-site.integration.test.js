import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../models/test-fixtures.js'
import { mockFileUploadSite } from '../../../../tests/test.fixture.js'
import { createActivityDetails } from '../../api/helpers/create-empty-activity-details.js'

describe('PATCH /marine-licence/site - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const existingActivityDetails = [createActivityDetails()]

  test('successfully updates site', async () => {
    const marineLicenceId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: marineLicenceId,
      contactId,
      siteDetails: [
        { coordinatesType: 'file', activityDetails: existingActivityDetails }
      ]
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/site',
      contactId,
      payload: {
        id: marineLicenceId.toString(),
        siteIndex: 0,
        siteDetails: { ...mockFileUploadSite, siteName: 'Updated Site' }
      }
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updated = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: marineLicenceId })

    expect(updated.siteDetails[0].siteName).toBe('Updated Site')
    expect(updated.siteDetails[0].activityDetails).toEqual(
      existingActivityDetails
    )
  })

  test('returns 404 when siteIndex is out of range', async () => {
    const marineLicenceId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: marineLicenceId,
      contactId,
      siteDetails: [
        { coordinatesType: 'file', activityDetails: [createActivityDetails()] }
      ]
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/site',
      contactId,
      payload: {
        id: marineLicenceId.toString(),
        siteIndex: 99,
        siteDetails: { ...mockFileUploadSite, siteName: 'Updated Site' }
      }
    })

    expect(statusCode).toBe(404)
  })

  test('returns 403 when attempting to update another users marine licence', async () => {
    const marineLicenceId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: marineLicenceId,
      contactId,
      siteDetails: {
        coordinatesType: 'file',
        activityDetails: [createActivityDetails()]
      }
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/site',
      contactId: '987e6543-e21b-12d3-a456-426614174000',
      payload: {
        id: marineLicenceId.toString(),
        siteIndex: 0,
        siteDetails: mockFileUploadSite
      }
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to request this resource')
  })
})
