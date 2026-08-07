import { setupTestServer } from '../../../../tests/test-server.js'
import { makePostRequest } from '../../../../tests/server-requests.js'
import { createCompleteMarineLicence } from '../../../../tests/test.fixture.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { ObjectId } from 'mongodb'

describe('Withdraw marine licence - integration tests', async () => {
  const getServer = await setupTestServer()
  const marineLicenceId = new ObjectId()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'

  const insertMarineLicence = async (status) => {
    await globalThis.mockMongo.collection(collectionMarineLicences).insertOne(
      createCompleteMarineLicence({
        _id: marineLicenceId,
        contactId,
        status,
        applicationReference: 'MLA/2026/10002',
        submittedAt: new Date('2026-05-10T00:00:00.000Z')
      })
    )
  }

  const findMarineLicence = () =>
    globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

  test('successfully withdraws a submitted marine licence when requested by the owner', async () => {
    await insertMarineLicence(MARINE_LICENCE_STATUS.SUBMITTED)

    const { statusCode, body } = await makePostRequest({
      server: getServer(),
      url: `/marine-licence/${marineLicenceId}/withdraw`,
      contactId,
      payload: {}
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ withdrawnAt: expect.any(String) })

    const withdrawnMarineLicence = await findMarineLicence()
    expect(withdrawnMarineLicence.status).toBe(MARINE_LICENCE_STATUS.WITHDRAWN)
    expect(withdrawnMarineLicence.withdrawnAt).toBeInstanceOf(Date)
    expect(withdrawnMarineLicence.updatedAt).toBeDefined()
    expect(withdrawnMarineLicence.updatedBy).toBe(contactId)
  })

  test('returns 404 when attempting to withdraw a non-existent marine licence', async () => {
    const nonExistentId = new ObjectId()

    const { statusCode } = await makePostRequest({
      server: getServer(),
      url: `/marine-licence/${nonExistentId}/withdraw`,
      contactId,
      payload: {}
    })

    expect(statusCode).toBe(404)
  })

  test('returns 403 when attempting to withdraw a marine licence owned by another user', async () => {
    await insertMarineLicence(MARINE_LICENCE_STATUS.SUBMITTED)

    const { statusCode } = await makePostRequest({
      server: getServer(),
      url: `/marine-licence/${marineLicenceId}/withdraw`,
      contactId: '987e6543-e21b-12d3-a456-426614174000',
      payload: {}
    })

    expect(statusCode).toBe(403)

    const untouchedMarineLicence = await findMarineLicence()
    expect(untouchedMarineLicence.status).toBe(MARINE_LICENCE_STATUS.SUBMITTED)
    expect(untouchedMarineLicence.withdrawnAt).toBeUndefined()
  })

  test.each([
    MARINE_LICENCE_STATUS.DRAFT,
    MARINE_LICENCE_STATUS.TRANSFERRED,
    MARINE_LICENCE_STATUS.WITHDRAWN
  ])('returns 400 when the marine licence status is %s', async (status) => {
    await insertMarineLicence(status)

    const { statusCode } = await makePostRequest({
      server: getServer(),
      url: `/marine-licence/${marineLicenceId}/withdraw`,
      contactId,
      payload: {}
    })

    expect(statusCode).toBe(400)

    const untouchedMarineLicence = await findMarineLicence()
    expect(untouchedMarineLicence.status).toBe(status)
  })
})
