import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../models/test-fixtures.js'
import { blobService } from '../../../shared/services/data-service/blob-service.js'

vi.mock('../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    deleteFiles: vi.fn()
  }
}))

describe('PATCH /marine-licence/delete-construction-drawing - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'

  const s3Location = (s3Key) => ({
    s3Bucket: 'mmo-uploads',
    s3Key,
    checksumSha256: 'abc123'
  })

  const buildPayload = (overrides = {}) => ({
    siteIndex: 0,
    drawingIndex: 0,
    ...overrides
  })

  test('successfully deletes the drawing at the given index, leaving other sites untouched', async () => {
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
    expect(updated.siteDetails[1].constructionDrawings).toEqual([
      { filename: 'other-site.pdf' }
    ])
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

  test('deletes the uploaded file from S3', async () => {
    const licenceId = new ObjectId()

    await globalThis.mockMongo.collection('marine-licences').insertOne({
      ...mockMarineLicence,
      _id: licenceId,
      contactId,
      siteDetails: [
        {
          coordinatesType: 'manual',
          constructionDrawings: [
            { filename: 'drawing-1.pdf', s3Location: s3Location('key-1') },
            { filename: 'drawing-2.pdf', s3Location: s3Location('key-2') }
          ]
        }
      ]
    })

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/delete-construction-drawing',
      contactId,
      payload: buildPayload({ id: licenceId.toString() })
    })

    expect(statusCode).toBe(200)
    expect(blobService.deleteFiles).toHaveBeenCalledWith([
      { s3Bucket: 'mmo-uploads', s3Key: 'key-1' }
    ])
  })

  test('leaves the file in S3 when another marine licence still references it', async () => {
    const licenceId = new ObjectId()
    const sharedS3Location = s3Location('shared-key')

    // A copy of a rejected licence duplicates the s3Location, so the object is
    // shared between the two documents
    await globalThis.mockMongo.collection('marine-licences').insertMany([
      {
        ...mockMarineLicence,
        _id: licenceId,
        contactId,
        siteDetails: [
          {
            coordinatesType: 'manual',
            constructionDrawings: [
              { filename: 'drawing-1.pdf', s3Location: sharedS3Location }
            ]
          }
        ]
      },
      {
        ...mockMarineLicence,
        _id: new ObjectId(),
        contactId,
        siteDetails: [
          {
            coordinatesType: 'manual',
            constructionDrawings: [
              { filename: 'drawing-1.pdf', s3Location: sharedS3Location }
            ]
          }
        ]
      }
    ])

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/delete-construction-drawing',
      contactId,
      payload: buildPayload({ id: licenceId.toString() })
    })

    expect(statusCode).toBe(200)
    expect(blobService.deleteFiles).not.toHaveBeenCalled()
  })

  test('still succeeds when the S3 delete fails', async () => {
    const licenceId = new ObjectId()
    blobService.deleteFiles.mockRejectedValue(new Error('S3 unavailable'))

    await globalThis.mockMongo.collection('marine-licences').insertOne({
      ...mockMarineLicence,
      _id: licenceId,
      contactId,
      siteDetails: [
        {
          coordinatesType: 'manual',
          constructionDrawings: [
            { filename: 'drawing-1.pdf', s3Location: s3Location('key-1') }
          ]
        }
      ]
    })

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

    expect(updated.siteDetails[0].constructionDrawings).toEqual([])
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
