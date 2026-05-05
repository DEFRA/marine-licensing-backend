import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../models/test-fixtures.js'
import { createActivityDetails } from '../../api/helpers/create-empty-activity-details.js'

describe('PATCH /marine-licence/delete-activity-details - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const marineLicenceId = new ObjectId()

  const emptyActivityDetails = createActivityDetails()

  const buildPayload = (overrides = {}) => ({
    id: marineLicenceId.toString(),
    siteIndex: 0,
    activityIndex: 0,
    ...overrides
  })

  test('successfully deletes the activity at the given index', async () => {
    const licenceId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: licenceId,
      contactId,
      siteDetails: [
        {
          coordinatesType: 'manual',
          activityDetails: [emptyActivityDetails, emptyActivityDetails]
        }
      ]
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/delete-activity-details',
      contactId,
      payload: buildPayload({ id: licenceId.toString() })
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updated = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: licenceId })

    expect(updated.siteDetails[0].activityDetails).toHaveLength(1)
  })

  test('returns 404 when siteIndex is invalid', async () => {
    const licenceId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: licenceId,
      contactId,
      siteDetails: [
        {
          coordinatesType: 'manual',
          activityDetails: [emptyActivityDetails]
        }
      ]
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/delete-activity-details',
      contactId,
      payload: buildPayload({ id: licenceId.toString(), siteIndex: 99 })
    })

    expect(statusCode).toBe(404)
  })

  test('returns 404 when activityIndex is invalid', async () => {
    const licenceId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: licenceId,
      contactId,
      siteDetails: [
        {
          coordinatesType: 'manual',
          activityDetails: [emptyActivityDetails]
        }
      ]
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/delete-activity-details',
      contactId,
      payload: buildPayload({ id: licenceId.toString(), activityIndex: 99 })
    })

    expect(statusCode).toBe(404)
  })
})
