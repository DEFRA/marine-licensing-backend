import { setupTestServer } from '../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../tests/server-requests.js'
import { createCompleteExemption } from '../../../../tests/test.fixture.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import { ObjectId } from 'mongodb'

describe('Get exemption summary - integration tests', async () => {
  const getServer = await setupTestServer()

  beforeEach(async () => {
    await globalThis.mockMongo.collection(collectionExemptions).deleteMany({})
  })

  test('returns aggregated counts for internal users', async () => {
    const exemptions = [
      createCompleteExemption({
        _id: new ObjectId(),
        status: EXEMPTION_STATUS.ACTIVE
      }),
      createCompleteExemption({
        _id: new ObjectId(),
        status: EXEMPTION_STATUS.ACTIVE
      }),
      createCompleteExemption({
        _id: new ObjectId(),
        status: EXEMPTION_STATUS.SUBMITTED
      }),
      createCompleteExemption({
        _id: new ObjectId(),
        status: EXEMPTION_STATUS.DRAFT
      }),
      createCompleteExemption({
        _id: new ObjectId(),
        status: EXEMPTION_STATUS.WITHDRAWN
      })
    ]

    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertMany(exemptions)

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/summary',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({
      submittedExemptions: 3,
      unsubmittedExemptions: 1,
      withdrawnExemptions: 1
    })
  })

  test('returns 403 for applicant users', async () => {
    const response = await getServer().inject({
      auth: {
        strategy: 'jwt',
        credentials: { contactId: 'applicant-user' },
        artifacts: { decoded: {} }
      },
      method: 'GET',
      url: '/exemptions/summary'
    })
    const parsed = JSON.parse(response.payload)

    expect(response.statusCode).toBe(403)
    expect(parsed.message).toBe('Not authorised to request this resource')
  })
})
