import { setupTestServer } from '../../../../tests/test-server.js'
import { makeDeleteRequest } from '../../../../tests/server-requests.js'
import { createCompleteMarineLicence } from '../../../../tests/test.fixture.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { ObjectId } from 'mongodb'
import { blobService } from '../../../shared/services/data-service/blob-service.js'

vi.mock('../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    deleteFiles: vi.fn()
  }
}))

describe('Delete marine licence - integration tests', async () => {
  const getServer = await setupTestServer()
  const marineLicenceId = new ObjectId()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'

  beforeEach(async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId,
      status: MARINE_LICENCE_STATUS.DRAFT
    })

    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)
  })

  test('successfully deletes a draft marine licence when requested by the owner', async () => {
    const { statusCode, body } = await makeDeleteRequest({
      server: getServer(),
      url: `/marine-licence/${marineLicenceId}`,
      contactId
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'Marine licence deleted successfully' })

    const deletedMarineLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })
    expect(deletedMarineLicence).toBeNull()
  })

  test('deletes every construction drawing and the water framework directive document from S3', async () => {
    const licenceId = new ObjectId()
    const s3Location = (s3Key) => ({
      s3Bucket: 'mmo-uploads',
      s3Key,
      checksumSha256: 'abc123'
    })

    await globalThis.mockMongo.collection(collectionMarineLicences).insertOne({
      ...createCompleteMarineLicence({
        _id: licenceId,
        contactId,
        status: MARINE_LICENCE_STATUS.DRAFT
      }),
      siteDetails: [
        {
          coordinatesType: 'manual',
          constructionDrawings: [
            { filename: 'drawing-1.pdf', s3Location: s3Location('key-1') },
            {}
          ]
        },
        {
          coordinatesType: 'manual',
          constructionDrawings: [
            { filename: 'drawing-2.pdf', s3Location: s3Location('key-2') }
          ]
        }
      ],
      waterFrameworkDirective: {
        nauticalMile: 'yes',
        excludedActivities: 'no',
        s3Location: s3Location('wfd-key')
      }
    })

    const { statusCode } = await makeDeleteRequest({
      server: getServer(),
      url: `/marine-licence/${licenceId}`,
      contactId
    })

    expect(statusCode).toBe(200)
    expect(blobService.deleteFiles).toHaveBeenCalledWith([
      { s3Bucket: 'mmo-uploads', s3Key: 'key-1' },
      { s3Bucket: 'mmo-uploads', s3Key: 'key-2' },
      { s3Bucket: 'mmo-uploads', s3Key: 'wfd-key' }
    ])
  })

  test('returns 404 when attempting to delete a non-existent marine licence', async () => {
    const nonExistentId = new ObjectId()

    const { statusCode, body } = await makeDeleteRequest({
      server: getServer(),
      url: `/marine-licence/${nonExistentId}`,
      contactId
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Not Found')
  })

  test('returns 400 when attempting to delete a submitted marine licence', async () => {
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOneAndUpdate(
        { _id: marineLicenceId },
        { $set: { status: MARINE_LICENCE_STATUS.SUBMITTED } }
      )

    const { statusCode, body } = await makeDeleteRequest({
      server: getServer(),
      url: `/marine-licence/${marineLicenceId}`,
      contactId
    })

    expect(statusCode).toBe(400)
    expect(body.message).toBe(
      `Cannot delete marine licence as marine licence must be the status '${MARINE_LICENCE_STATUS.DRAFT}'.`
    )

    const stillExistingMarineLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })
    expect(stillExistingMarineLicence).not.toBeNull()
  })

  test('returns 403 when attempting to delete a marine licence owned by another user', async () => {
    const { statusCode, body } = await makeDeleteRequest({
      server: getServer(),
      url: `/marine-licence/${marineLicenceId}`,
      contactId: differentContactId
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to request this resource')

    const stillExistingMarineLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })
    expect(stillExistingMarineLicence).not.toBeNull()
  })
})
