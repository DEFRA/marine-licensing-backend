import { setupTestServer } from '../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../tests/server-requests.js'
import { ObjectId } from 'mongodb'
import { mockMarineLicence } from '../../models/test-fixtures.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import Wreck from '@hapi/wreck'

vi.mock('../../../shared/common/helpers/dynamics/get-access-token.js', () => ({
  getDynamicsAccessToken: vi.fn().mockResolvedValue('abc')
}))
vi.mock('@hapi/wreck')

const mockDynamicsContactDetailsApi = () => {
  vi.mocked(Wreck.get).mockResolvedValue({
    payload: Buffer.from(JSON.stringify({ fullname: 'Dave Barnett' }))
  })
}

describe('Get marine licence - integration tests', async () => {
  process.env.DYNAMICS_API_URL = 'test'
  process.env.DYNAMICS_ENABLED = true
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

    expect(body.whoMarineLicenceIsFor).toBeUndefined()
  })

  test('requested by a public user', async () => {
    const publicId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: publicId,
      contactId: '9687cdd5-49e7-4508-b56c-08a4d02c43c2',
      status: MARINE_LICENCE_STATUS.SUBMITTED,
      organisation: null
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)
    mockDynamicsContactDetailsApi()

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: `/public/marine-licence/${publicId}`
    })
    expect(statusCode).toBe(200)

    const { _id, ...rest } = marineLicence
    expect(body).toEqual({
      ...rest,
      id: _id.toString(),
      createdAt: marineLicence.createdAt.toISOString(),
      updatedAt: marineLicence.updatedAt.toISOString(),
      whoMarineLicenceIsFor: 'Dave Barnett',
      taskList: {
        projectName: 'COMPLETED'
      }
    })
  })

  test('returns 403 when public user requests a non SUBMITTED marine licence', async () => {
    const draftId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: draftId,
      status: MARINE_LICENCE_STATUS.DRAFT
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const server = getServer()
    const response = await server.inject({
      method: 'GET',
      url: `/public/marine-licence/${draftId}`
    })

    expect(response.statusCode).toBe(403)
  })
})
