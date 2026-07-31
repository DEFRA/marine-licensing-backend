import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../models/test-fixtures.js'

describe('PATCH /marine-licence/add-construction-drawing - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const marineLicenceId = new ObjectId()

  const mockSite = {
    coordinatesType: 'manual'
  }

  const buildPayload = (overrides = {}) => ({
    id: marineLicenceId.toString(),
    siteIndex: 0,
    ...overrides
  })

  test('successfully adds an empty construction drawing to the correct site', async () => {
    const marineLicence = {
      ...mockMarineLicence,
      _id: marineLicenceId,
      contactId,
      siteDetails: [mockSite],
      siteDetailsConfirmed: true
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/add-construction-drawing',
      contactId,
      payload: buildPayload()
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updated = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: marineLicenceId })

    expect(updated.siteDetails[0].constructionDrawings).toEqual([{}])
    expect(updated.siteDetailsConfirmed).toBe(false)
  })

  test('returns 404 when siteIndex is out of range', async () => {
    const siteId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: siteId,
      contactId,
      siteDetails: [mockSite]
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/add-construction-drawing',
      contactId,
      payload: buildPayload({ id: siteId.toString(), siteIndex: 99 })
    })

    expect(statusCode).toBe(404)
  })
})
