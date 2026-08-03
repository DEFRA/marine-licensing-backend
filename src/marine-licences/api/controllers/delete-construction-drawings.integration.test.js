import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../models/test-fixtures.js'

describe('PATCH /marine-licence/delete-construction-drawings - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'

  const buildPayload = (overrides = {}) => ({
    siteIndex: 0,
    ...overrides
  })

  test('successfully deletes all drawings for the given site', async () => {
    const licenceId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: licenceId,
      contactId,
      siteDetails: [
        {
          coordinatesType: 'manual',
          constructionDrawings: [
            { filename: 'drawing-1.pdf' },
            { filename: 'drawing-2.pdf' }
          ]
        },
        {
          coordinatesType: 'manual',
          constructionDrawings: [{ filename: 'other-site.pdf' }]
        }
      ],
      siteDetailsConfirmed: true
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/delete-construction-drawings',
      contactId,
      payload: buildPayload({ id: licenceId.toString() })
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updated = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: licenceId })

    expect(updated.siteDetails[0].constructionDrawings).toBeUndefined()
    expect(updated.siteDetails[1].constructionDrawings).toEqual([
      { filename: 'other-site.pdf' }
    ])
    expect(updated.siteDetailsConfirmed).toBe(false)
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
          constructionDrawings: [{ filename: 'drawing-1.pdf' }]
        }
      ]
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/delete-construction-drawings',
      contactId,
      payload: buildPayload({ id: licenceId.toString(), siteIndex: 99 })
    })

    expect(statusCode).toBe(404)
  })
})
