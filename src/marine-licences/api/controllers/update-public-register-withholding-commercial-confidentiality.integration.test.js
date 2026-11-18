import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { createCompleteMarineLicence } from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

const url = '/marine-licence/public-register-commercial-confidentiality'
const choice = {
  withholdConsent: 'yes',
  withholdReason: 'commercialConfidentiality'
}

describe('PATCH /marine-licence/public-register-commercial-confidentiality - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'
  const marineLicenceId = new ObjectId()

  const insertLicence = (publicRegister) =>
    globalThis.mockMongo.collection(collectionMarineLicences).insertOne(
      createCompleteMarineLicence({
        _id: marineLicenceId,
        contactId,
        publicRegister
      })
    )

  const findLicence = () =>
    globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

  const patch = (payload, patchContactId = contactId) =>
    makePatchRequest({
      server: getServer(),
      url,
      contactId: patchContactId,
      payload: { id: marineLicenceId.toString(), ...payload }
    })

  test('saves the withholding choice and reason together', async () => {
    await insertLicence({ withholdConsent: 'no', withholdReason: null })

    const { statusCode, body } = await patch({
      ...choice,
      reason: '  Pricing details  '
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updatedLicence = await findLicence()
    expect(updatedLicence.publicRegister).toEqual({
      ...choice,
      reason: 'Pricing details'
    })
    expect(updatedLicence.publicRegisterConfirmed).toBe(false)
    expect(updatedLicence.updatedBy).toBe(contactId)
    expect(updatedLicence.updatedAt).toBeInstanceOf(Date)
  })

  test('replaces national security answers', async () => {
    await insertLicence({
      withholdConsent: 'yes',
      withholdReason: 'nationalSecurity',
      nationalSecurityApproval: 'yes',
      reason: 'Details of the berth'
    })

    const { statusCode } = await patch({ ...choice, reason: 'Pricing details' })

    expect(statusCode).toBe(200)

    const updatedLicence = await findLicence()
    expect(updatedLicence.publicRegister).toEqual({
      ...choice,
      reason: 'Pricing details'
    })
  })

  test('returns 400 without a reason', async () => {
    await insertLicence({ withholdConsent: 'no', withholdReason: null })

    const { statusCode, body } = await patch(choice)

    expect(statusCode).toBe(400)
    expect(body.message).toContain(
      'PUBLIC_REGISTER_COMMERCIAL_CONFIDENTIALITY_REASON_REQUIRED'
    )

    const unchangedLicence = await findLicence()
    expect(unchangedLicence.publicRegister).toEqual({
      withholdConsent: 'no',
      withholdReason: null
    })
  })

  test("returns 403 when attempting to update another user's marine licence", async () => {
    await insertLicence({ withholdConsent: 'no', withholdReason: null })

    const { statusCode } = await patch(
      { ...choice, reason: 'Pricing details' },
      differentContactId
    )

    expect(statusCode).toBe(403)

    const unchangedLicence = await findLicence()
    expect(unchangedLicence.publicRegister).toEqual({
      withholdConsent: 'no',
      withholdReason: null
    })
  })
})
