import { setupTestServer } from '../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../models/test-fixtures.js'

describe('Get marine licence - integration tests', async () => {
  const getServer = await setupTestServer()
  const marineLicenceId = new ObjectId()

  test('requested by user who created the marine licence', async () => {
    const marineLicence = {
      ...mockMarineLicence,
      _id: marineLicenceId,
      organisation: null
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: `/marine-licence/${marineLicenceId}`,
      contactId: marineLicence.contactId
    })
    expect(statusCode).toBe(200)

    const { _id, ...rest } = marineLicence
    expect(body).toEqual({
      ...rest,
      id: _id.toString(),
      createdAt: marineLicence.createdAt.toISOString(),
      updatedAt: marineLicence.updatedAt.toISOString(),
      taskList: {
        projectName: 'COMPLETED'
      }
    })

    expect(body.whomarineLicenceIsFor).toBeUndefined()
  })
})
