import { setupTestServer } from '../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../tests/server-requests.js'
import { createCompleteExemption } from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { EXEMPTION_STATUS } from '../../../shared/common/constants/exemption.js'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'

describe('Get exemptions - integration tests', async () => {
  const getServer = await setupTestServer()

  test('returns a list of exemptions', async () => {
    const exemptionId1 = new ObjectId()
    const exemptionId2 = new ObjectId()
    const exemption1 = createCompleteExemption({
      _id: exemptionId1,
      organisation: null,
      status: EXEMPTION_STATUS.ACTIVE
    })
    const exemption2 = createCompleteExemption({
      _id: exemptionId2,
      organisation: null,
      status: EXEMPTION_STATUS.DRAFT
    })
    const exemptions = [exemption1, exemption2]
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertMany(exemptions)

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions',
      contactId: exemption1.contactId // request is from an applicant
    })
    expect(statusCode).toBe(200)
    expect(body).toHaveLength(exemptions.length)
    body.forEach((exemption) => {
      const dbExemption = exemptions.find(
        ({ _id }) => _id.toString() === exemption.id
      )
      expect(exemption).toEqual({
        id: dbExemption._id.toString(),
        status:
          dbExemption.status === EXEMPTION_STATUS.DRAFT ? 'Draft' : 'Active',
        projectName: dbExemption.projectName
      })
    })
  })
})
