import { setupTestServer } from '../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../tests/server-requests.js'
import { createCompleteExemption } from '../../../../tests/test.fixture.js'
import {
  EXEMPTION_STATUS,
  EXEMPTION_STATUS_LABEL
} from '../../../common/constants/exemption.js'
import { collectionExemptions } from '../../../common/constants/db-collections.js'
import Wreck from '@hapi/wreck'
import { ObjectId } from 'mongodb'
vi.mock('../../../common/helpers/dynamics/get-access-token.js', () => ({
  getDynamicsAccessToken: vi.fn().mockResolvedValue('abc')
}))
vi.mock('@hapi/wreck')

const mockDynamicsContactDetailsApi = () => {
  vi.mocked(Wreck.get).mockResolvedValue({
    payload: Buffer.from(JSON.stringify({ fullname: 'Dave Barnett' }))
  })
}

const compareResponseWithDbExemption = (response, dbExemption) => {
  const { _id, status, ...rest } = dbExemption
  const site = dbExemption.siteDetails[0]
  expect(response).toEqual({
    ...rest,
    id: _id.toString(),
    status: EXEMPTION_STATUS_LABEL[status] || status,
    createdAt: dbExemption.createdAt.toISOString(),
    updatedAt: dbExemption.updatedAt.toISOString(),
    siteDetails: [
      {
        ...site,
        activityDates: {
          start: site.activityDates.start.toISOString(),
          end: site.activityDates.end.toISOString()
        }
      }
    ],
    taskList: {
      publicRegister: 'COMPLETED',
      projectName: 'COMPLETED',
      siteDetails: 'COMPLETED'
    }
  })
}

describe('Get exemption - integration tests', async () => {
  process.env.DYNAMICS_API_URL = 'test'
  process.env.DYNAMICS_ENABLED = true
  const getServer = await setupTestServer()
  const exemptionId = new ObjectId()

  test('requested by an applicant', async () => {
    const exemption = createCompleteExemption({
      _id: exemptionId,
      organisation: null
    })
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(exemption)

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: `/exemption/${exemptionId}`,
      contactId: exemption.contactId // request is from an applicant
    })
    expect(statusCode).toBe(200)
    compareResponseWithDbExemption(body, exemption)
    // when requested by an applicant, the contact name is not returned
    expect(body.whoExemptionIsFor).toBeUndefined()
  })

  test('requested by an internal user', async () => {
    const exemption = createCompleteExemption({
      _id: exemptionId,
      organisation: null
    })
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(exemption)
    mockDynamicsContactDetailsApi()

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: `/exemption/${exemption._id}`,
      isInternalUser: true
    })
    expect(statusCode).toBe(200)
    // when an exemption is requested by an internal user, and the applicant isn't linked to an organisation, then the applicant's contact name is included in the response
    compareResponseWithDbExemption(body, {
      ...exemption,
      whoExemptionIsFor: 'Dave Barnett'
    })
  })

  test('requested by a public user', async () => {
    const exemption = createCompleteExemption({
      _id: exemptionId,
      organisation: null,
      status: EXEMPTION_STATUS.ACTIVE
    })
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(exemption)
    mockDynamicsContactDetailsApi()

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: `/public/exemption/${exemption._id}`
    })
    expect(statusCode).toBe(200)
    // when an exemption is requested by a public user, and the applicant isn't linked to an organisation, then the applicant's contact name is included in the response
    compareResponseWithDbExemption(body, {
      ...exemption,
      whoExemptionIsFor: 'Dave Barnett'
    })
  })

  test('withdrawn exemption requested by a public user', async () => {
    const exemption = createCompleteExemption({
      _id: exemptionId,
      organisation: null,
      status: EXEMPTION_STATUS.WITHDRAWN,
      withdrawnAt: new Date('2026-02-16')
    })
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(exemption)
    mockDynamicsContactDetailsApi()

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: `/public/exemption/${exemption._id}`
    })
    expect(statusCode).toBe(200)
    compareResponseWithDbExemption(body, {
      ...exemption,
      withdrawnAt: exemption.withdrawnAt.toISOString(),
      whoExemptionIsFor: 'Dave Barnett'
    })
  })
})
