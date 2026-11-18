import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { createCompleteMarineLicence } from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

const url = '/marine-licence/public-register-national-security'
const choice = { withholdConsent: 'yes', withholdReason: 'nationalSecurity' }

describe('PATCH /marine-licence/public-register-national-security - integration tests', async () => {
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

  test('saves the withholding choice, answer and reason together', async () => {
    await insertLicence({ withholdConsent: 'no', withholdReason: null })

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url,
      contactId,
      payload: {
        id: marineLicenceId.toString(),
        ...choice,
        nationalSecurityApproval: 'yes',
        reason: '  Details of the berth  '
      }
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updatedLicence = await findLicence()
    expect(updatedLicence.publicRegister).toEqual({
      withholdConsent: 'yes',
      withholdReason: 'nationalSecurity',
      nationalSecurityApproval: 'yes',
      reason: 'Details of the berth'
    })
    expect(updatedLicence.publicRegisterConfirmed).toBe(false)
    expect(updatedLicence.updatedBy).toBe(contactId)
    expect(updatedLicence.updatedAt).toBeInstanceOf(Date)
  })

  test('removes a saved reason when the answer changes to no', async () => {
    await insertLicence({
      withholdConsent: 'yes',
      withholdReason: 'nationalSecurity',
      nationalSecurityApproval: 'yes',
      reason: 'Details of the berth'
    })

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url,
      contactId,
      payload: {
        id: marineLicenceId.toString(),
        ...choice,
        nationalSecurityApproval: 'no'
      }
    })

    expect(statusCode).toBe(200)

    const updatedLicence = await findLicence()
    expect(updatedLicence.publicRegister).toEqual({
      withholdConsent: 'yes',
      withholdReason: 'nationalSecurity',
      nationalSecurityApproval: 'no'
    })
  })

  test('returns 400 when approved without a reason', async () => {
    await insertLicence({
      withholdConsent: 'yes',
      withholdReason: 'nationalSecurity'
    })

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url,
      contactId,
      payload: {
        id: marineLicenceId.toString(),
        ...choice,
        nationalSecurityApproval: 'yes'
      }
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain(
      'PUBLIC_REGISTER_NATIONAL_SECURITY_REASON_REQUIRED'
    )
  })

  test("returns 403 when attempting to update another user's marine licence", async () => {
    await insertLicence({
      withholdConsent: 'yes',
      withholdReason: 'nationalSecurity'
    })

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url,
      contactId: differentContactId,
      payload: {
        id: marineLicenceId.toString(),
        ...choice,
        nationalSecurityApproval: 'no'
      }
    })

    expect(statusCode).toBe(403)

    const unchangedLicence = await findLicence()
    expect(unchangedLicence.publicRegister.nationalSecurityApproval).toBe(
      undefined
    )
  })

  test('replaces commercial confidentiality answers', async () => {
    await insertLicence({
      withholdConsent: 'yes',
      withholdReason: 'commercialConfidentiality',
      reason: 'Pricing details'
    })

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url,
      contactId,
      payload: {
        id: marineLicenceId.toString(),
        ...choice,
        nationalSecurityApproval: 'no'
      }
    })

    expect(statusCode).toBe(200)

    const updatedLicence = await findLicence()
    expect(updatedLicence.publicRegister).toEqual({
      ...choice,
      nationalSecurityApproval: 'no'
    })
  })

  test('returns 400 when the withholding choice is missing', async () => {
    await insertLicence({ withholdConsent: 'no', withholdReason: null })

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url,
      contactId,
      payload: {
        id: marineLicenceId.toString(),
        nationalSecurityApproval: 'no'
      }
    })

    expect(statusCode).toBe(400)

    const unchangedLicence = await findLicence()
    expect(unchangedLicence.publicRegister).toEqual({
      withholdConsent: 'no',
      withholdReason: null
    })
  })
})
