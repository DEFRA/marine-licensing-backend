import { setupTestServer } from '../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicense } from '../../../models/marine-licenses/test-fixtures.js'

describe('Get marine license - integration tests', async () => {
  const getServer = await setupTestServer()
  const marineLicenseId = new ObjectId()

  test('requested by user who created the marine license', async () => {
    const marineLicense = {
      ...mockMarineLicense,
      _id: marineLicenseId,
      organisation: null
    }

    await globalThis.mockMongo
      .collection('marine-licenses')
      .insertOne(marineLicense)

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: `/marine-license/${marineLicenseId}`,
      contactId: marineLicense.contactId
    })
    expect(statusCode).toBe(200)

    const { _id, ...rest } = marineLicense
    expect(body).toEqual({
      ...rest,
      id: _id.toString(),
      createdAt: marineLicense.createdAt.toISOString(),
      updatedAt: marineLicense.updatedAt.toISOString(),
      taskList: {
        projectName: 'COMPLETED'
      }
    })

    expect(body.whoMarineLicenseIsFor).toBeUndefined()
  })
})
