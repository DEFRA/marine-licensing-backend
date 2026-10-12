import { setupTestServer } from '../../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { createCompleteMarineLicence } from '../../../../../tests/test.fixture.js'

describe('PATCH /marine-licence/update-site-notice-evidence - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'

  const mockMarineLicence = createCompleteMarineLicence()

  const insertLicence = async (siteNoticeEvidence = [{}]) => {
    const licenceId = new ObjectId()

    await globalThis.mockMongo.collection(collectionMarineLicences).insertOne({
      ...mockMarineLicence,
      _id: licenceId,
      contactId,
      siteNoticeEvidence
    })

    return licenceId
  }

  test('sets location name without removing other saved fields', async () => {
    const licenceId = await insertLicence([
      { dateDisplayed: { day: '01', month: '01', year: '2020' } }
    ])

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/update-site-notice-evidence',
      contactId,
      payload: {
        id: licenceId.toString(),
        evidenceIndex: 0,
        locationName: 'North pier'
      }
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updated = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: licenceId })

    expect(updated.siteNoticeEvidence[0]).toEqual({
      dateDisplayed: { day: '01', month: '01', year: '2020' },
      locationName: 'North pier'
    })
  })

  test('returns 404 when the evidence index does not exist', async () => {
    const licenceId = await insertLicence([{}])

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/update-site-notice-evidence',
      contactId,
      payload: {
        id: licenceId.toString(),
        evidenceIndex: 1,
        locationName: 'North pier'
      }
    })

    expect(statusCode).toBe(404)
    expect(body.message).toContain('invalid evidence index of 1')
  })

  test('returns 403 when updating another users marine licence', async () => {
    const licenceId = await insertLicence()

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/update-site-notice-evidence',
      contactId: differentContactId,
      payload: {
        id: licenceId.toString(),
        evidenceIndex: 0,
        locationName: 'North pier'
      }
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to request this resource')
  })

  test('returns 400 when no evidence field is present', async () => {
    const licenceId = await insertLicence()

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/update-site-notice-evidence',
      contactId,
      payload: {
        id: licenceId.toString(),
        evidenceIndex: 0
      }
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('SITE_NOTICE_EVIDENCE_REQUIRED')
  })
})
