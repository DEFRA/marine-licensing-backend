import { ObjectId } from 'mongodb'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import {
  createCompleteExemption,
  mockCredentials
} from '../../../../tests/test.fixture.js'
import { setupTestServer } from '../../../../tests/test-server.js'

describe('POST /exemption/backfill-areas', async () => {
  const getServer = await setupTestServer()
  let db
  let exemptionId

  beforeEach(async () => {
    db = globalThis.mockMongo
    exemptionId = new ObjectId()

    await db.collection(collectionExemptions).deleteMany({})
  })

  it('should successfully backfill areas for an ACTIVE exemption', async () => {
    const exemption = createCompleteExemption({
      _id: exemptionId,
      status: EXEMPTION_STATUS.ACTIVE,
      applicationReference: 'EXE/2026/001',
      marinePlanAreas: ['South East Inshore'],
      contactId: mockCredentials.contactId
    })

    await db.collection(collectionExemptions).insertOne(exemption)

    const response = await getServer().inject({
      method: 'POST',
      url: '/exemption/backfill-areas',
      payload: { id: exemptionId.toHexString() },
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    expect(response.statusCode).toBe(200)

    const payload = JSON.parse(response.payload)

    expect(payload).toEqual({
      message: 'success',
      value: {
        applicationReference: 'EXE/2026/001',
        message: 'Backfill for Exemption is successful'
      }
    })

    const updated = await db
      .collection(collectionExemptions)
      .findOne({ _id: exemptionId })
    expect(updated.areaBackfillCompleteAt).toBeDefined()
  })

  it('should return 400 when no id is provided', async () => {
    const response = await getServer().inject({
      method: 'POST',
      url: '/exemption/backfill-areas',
      payload: {},
      auth: {
        strategy: 'jwt',
        credentials: mockCredentials
      }
    })

    expect(response.statusCode).toBe(400)
  })
})
