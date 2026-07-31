import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../models/test-fixtures.js'

describe('PATCH /marine-licence/delete-construction-drawing - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'

  const buildPayload = (overrides = {}) => ({
    siteIndex: 0,
    drawingIndex: 0,
    ...overrides
  })

  test('successfully deletes the drawing at the given index', async () => {
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
        }
      ],
      siteDetailsConfirmed: true
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/delete-construction-drawing',
      contactId,
      payload: buildPayload({ id: licenceId.toString() })
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updated = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: licenceId })

    expect(updated.siteDetails[0].constructionDrawings).toHaveLength(1)
    expect(updated.siteDetails[0].constructionDrawings[0]).toEqual({
      filename: 'drawing-2.pdf'
    })
    expect(updated.siteDetailsConfirmed).toBe(false)
  })

  test('renumbers remaining drawings after deleting a middle item', async () => {
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
            { filename: 'drawing-2.pdf' },
            { filename: 'drawing-3.pdf' }
          ]
        }
      ],
      siteDetailsConfirmed: true
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/delete-construction-drawing',
      contactId,
      payload: buildPayload({ id: licenceId.toString(), drawingIndex: 1 })
    })

    expect(statusCode).toBe(200)

    const updated = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: licenceId })

    expect(updated.siteDetails[0].constructionDrawings).toEqual([
      { filename: 'drawing-1.pdf' },
      { filename: 'drawing-3.pdf' }
    ])
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
      url: '/marine-licence/delete-construction-drawing',
      contactId,
      payload: buildPayload({ id: licenceId.toString(), siteIndex: 99 })
    })

    expect(statusCode).toBe(404)
  })

  test('returns 404 when drawingIndex is invalid', async () => {
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
      url: '/marine-licence/delete-construction-drawing',
      contactId,
      payload: buildPayload({ id: licenceId.toString(), drawingIndex: 99 })
    })

    expect(statusCode).toBe(404)
  })
})
