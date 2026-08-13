import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../models/test-fixtures.js'
import { blobService } from '../../../shared/services/data-service/blob-service.js'

vi.mock('../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    getMetadata: vi.fn(),
    deleteFiles: vi.fn()
  }
}))

describe('PATCH /marine-licence/update-construction-drawing - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'

  const s3Location = {
    s3Bucket: 'mmo-uploads',
    s3Key: 'test-file-key',
    checksumSha256: 'test-checksum'
  }

  const buildPayload = (overrides = {}) => ({
    siteIndex: 0,
    drawingIndex: 0,
    filename: 'drawing.pdf',
    s3Location,
    ...overrides
  })

  beforeEach(() => {
    blobService.getMetadata.mockResolvedValue({
      size: 1_000_000,
      contentType: 'application/pdf'
    })
  })

  const insertLicenceWithDrawing = async () => {
    const licenceId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: licenceId,
      contactId,
      siteDetails: [
        {
          coordinatesType: 'manual',
          constructionDrawings: [{}]
        }
      ],
      siteDetailsConfirmed: true
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    return licenceId
  }

  const insertLicenceWithNoDrawingsYet = async () => {
    const licenceId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: licenceId,
      contactId,
      siteDetails: [
        {
          coordinatesType: 'manual'
        }
      ],
      siteDetailsConfirmed: true
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    return licenceId
  }

  test('successfully uploads the very first drawing for a site with no constructionDrawings array yet', async () => {
    const licenceId = await insertLicenceWithNoDrawingsYet()

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/update-construction-drawing',
      contactId,
      payload: buildPayload({ id: licenceId.toString() })
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updated = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: licenceId })

    expect(Array.isArray(updated.siteDetails[0].constructionDrawings)).toBe(
      true
    )
    expect(updated.siteDetails[0].constructionDrawings[0]).toEqual({
      filename: 'drawing.pdf',
      s3Location
    })
    expect(updated.siteDetailsConfirmed).toBe(false)
  })

  test('adding a second drawing after the first still results in a real array', async () => {
    const licenceId = await insertLicenceWithNoDrawingsYet()

    await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/update-construction-drawing',
      contactId,
      payload: buildPayload({ id: licenceId.toString() })
    })

    await globalThis.mockMongo.collection('marine-licences').updateOne(
      { _id: licenceId },
      {
        $push: { 'siteDetails.0.constructionDrawings': {} }
      }
    )

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/update-construction-drawing',
      contactId,
      payload: buildPayload({
        id: licenceId.toString(),
        drawingIndex: 1,
        filename: 'second.pdf'
      })
    })

    expect(statusCode).toBe(200)

    const updated = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: licenceId })

    expect(Array.isArray(updated.siteDetails[0].constructionDrawings)).toBe(
      true
    )
    expect(updated.siteDetails[0].constructionDrawings).toHaveLength(2)
    expect(updated.siteDetails[0].constructionDrawings[1]).toEqual({
      filename: 'second.pdf',
      s3Location
    })
  })

  test('successfully fills in an empty drawing slot', async () => {
    const licenceId = await insertLicenceWithDrawing()

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/update-construction-drawing',
      contactId,
      payload: buildPayload({ id: licenceId.toString() })
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updated = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: licenceId })

    expect(updated.siteDetails[0].constructionDrawings[0]).toEqual({
      filename: 'drawing.pdf',
      s3Location
    })
    expect(updated.siteDetailsConfirmed).toBe(false)
  })

  test('successfully replaces an existing drawing', async () => {
    const licenceId = await insertLicenceWithDrawing()

    await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/update-construction-drawing',
      contactId,
      payload: buildPayload({ id: licenceId.toString() })
    })

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/update-construction-drawing',
      contactId,
      payload: buildPayload({
        id: licenceId.toString(),
        filename: 'replacement.pdf'
      })
    })

    expect(statusCode).toBe(200)

    const updated = await globalThis.mockMongo
      .collection('marine-licences')
      .findOne({ _id: licenceId })

    expect(updated.siteDetails[0].constructionDrawings[0]).toEqual({
      filename: 'replacement.pdf',
      s3Location
    })
  })

  test('deletes the replaced drawing file from S3', async () => {
    const licenceId = new ObjectId()

    await globalThis.mockMongo.collection('marine-licences').insertOne({
      ...mockMarineLicence,
      _id: licenceId,
      contactId,
      siteDetails: [
        {
          coordinatesType: 'manual',
          constructionDrawings: [
            {
              filename: 'previous.pdf',
              s3Location: { ...s3Location, s3Key: 'previous-file-key' }
            }
          ]
        }
      ]
    })

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/update-construction-drawing',
      contactId,
      payload: buildPayload({ id: licenceId.toString() })
    })

    expect(statusCode).toBe(200)
    expect(blobService.deleteFiles).toHaveBeenCalledWith([
      { s3Bucket: 'mmo-uploads', s3Key: 'previous-file-key' }
    ])
  })

  test('does not delete the file when the same s3 key is re-uploaded', async () => {
    const licenceId = new ObjectId()

    await globalThis.mockMongo.collection('marine-licences').insertOne({
      ...mockMarineLicence,
      _id: licenceId,
      contactId,
      siteDetails: [
        {
          coordinatesType: 'manual',
          constructionDrawings: [{ filename: 'previous.pdf', s3Location }]
        }
      ]
    })

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/update-construction-drawing',
      contactId,
      payload: buildPayload({ id: licenceId.toString() })
    })

    expect(statusCode).toBe(200)
    expect(blobService.deleteFiles).not.toHaveBeenCalled()
  })

  test('returns 404 when drawingIndex is invalid', async () => {
    const licenceId = await insertLicenceWithDrawing()

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/update-construction-drawing',
      contactId,
      payload: buildPayload({ id: licenceId.toString(), drawingIndex: 99 })
    })

    expect(statusCode).toBe(404)
  })

  test('returns 403 when s3 bucket does not match configured upload bucket', async () => {
    const licenceId = await insertLicenceWithDrawing()

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/update-construction-drawing',
      contactId,
      payload: buildPayload({
        id: licenceId.toString(),
        s3Location: { ...s3Location, s3Bucket: 'wrong-bucket' }
      })
    })

    expect(statusCode).toBe(403)
  })

  test('returns 400 when filename is missing', async () => {
    const licenceId = await insertLicenceWithDrawing()

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/update-construction-drawing',
      contactId,
      payload: {
        siteIndex: 0,
        drawingIndex: 0,
        id: licenceId.toString(),
        s3Location
      }
    })

    expect(statusCode).toBe(400)
  })
})
