import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import {
  findMarineLicence,
  insertMarineLicence
} from '../../../../tests/test-helpers.js'
import { ObjectId } from 'mongodb'

const url = '/marine-licence/confirm-public-register'

describe('PATCH /marine-licence/confirm-public-register - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'
  const marineLicenceId = new ObjectId()

  const insertLicence = () =>
    insertMarineLicence({
      _id: marineLicenceId,
      contactId,
      publicRegisterConfirmed: false
    })

  test('sets publicRegisterConfirmed to true without changing the answers', async () => {
    await insertLicence()

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url,
      contactId,
      payload: { id: marineLicenceId.toString() }
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updatedLicence = await findMarineLicence(marineLicenceId)

    expect(updatedLicence.publicRegisterConfirmed).toBe(true)
    expect(updatedLicence.publicRegister).toEqual({
      withholdConsent: 'yes',
      withholdReason: 'nationalSecurity',
      nationalSecurityApproval: 'no'
    })
  })

  test("returns 403 when attempting to update another user's marine licence", async () => {
    await insertLicence()

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url,
      contactId: differentContactId,
      payload: { id: marineLicenceId.toString() }
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to request this resource')

    const unchangedLicence = await findMarineLicence(marineLicenceId)
    expect(unchangedLicence.publicRegisterConfirmed).toBe(false)
  })
})
