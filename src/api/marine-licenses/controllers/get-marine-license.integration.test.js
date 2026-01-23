import { setupTestServer } from '../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { MARINE_LICENSE_STATUS } from '../../../common/constants/marine-license.js'

const createCompleteMarineLicense = (overrides = {}) => {
  const marineLicenseId = overrides._id || new ObjectId()
  const contactId =
    overrides.contactId || '123e4567-e89b-12d3-a456-426614174000'

  return {
    _id: marineLicenseId,
    contactId,
    projectName: 'Test Marine License Project',
    status: MARINE_LICENSE_STATUS.DRAFT,
    createdAt: new Date('2026-12-01'),
    updatedAt: new Date('2026-12-01'),
    ...overrides
  }
}

const compareResponseWithDbMarineLicense = (response, dbMarineLicense) => {
  const { _id, ...rest } = dbMarineLicense
  expect(response).toEqual({
    ...rest,
    id: _id.toString(),
    createdAt: dbMarineLicense.createdAt.toISOString(),
    updatedAt: dbMarineLicense.updatedAt.toISOString(),
    taskList: {
      projectName: 'COMPLETED'
    }
  })
}

describe('Get marine license - integration tests', async () => {
  const getServer = await setupTestServer()
  const marineLicenseId = new ObjectId()

  test('requested by user who created the marine license', async () => {
    const marineLicense = createCompleteMarineLicense({
      _id: marineLicenseId,
      organisation: null
    })
    await globalThis.mockMongo
      .collection('marine-licenses')
      .insertOne(marineLicense)

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: `/marine-license/${marineLicenseId}`,
      contactId: marineLicense.contactId
    })
    expect(statusCode).toBe(200)
    compareResponseWithDbMarineLicense(body, marineLicense)

    expect(body.whoMarineLicenseIsFor).toBeUndefined()
  })
})
