import { setupTestServer } from '../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../tests/server-requests.js'
import { createCompleteExemption } from '../../../../tests/test.fixture.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import { ObjectId } from 'mongodb'

describe('Get backfill for exemptions - integration tests', async () => {
  const getServer = await setupTestServer()

  let activeExemption1, activeExemption2, draftExemption

  beforeEach(async () => {
    await globalThis.mockMongo.collection(collectionExemptions).deleteMany({})
    const exemptionId1 = new ObjectId()
    activeExemption1 = createCompleteExemption({
      _id: exemptionId1,
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Test Project',
      applicationReference: 'EXEMPTION-2026-001',
      submittedAt: '2026-01-04'
    })

    const exemptionId2 = new ObjectId()
    activeExemption2 = createCompleteExemption({
      _id: exemptionId2,
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Second Project',
      applicationReference: 'EXEMPTION-2026-002',
      submittedAt: '2026-02-06'
    })

    const exemptionId3 = new ObjectId()
    draftExemption = createCompleteExemption({
      _id: exemptionId3,
      status: EXEMPTION_STATUS.DRAFT,
      projectName: 'Draft Project'
    })
  })

  test('returns only ACTIVE exemptions sorted by submitted date (newest first)', async () => {
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertMany([activeExemption1, activeExemption2, draftExemption])

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/backfill-areas',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body.backfillAreas).toHaveLength(2)

    expect(body.backfillAreas).toEqual([
      {
        _id: activeExemption2._id.toString(),
        applicationReference: activeExemption2.applicationReference,
        projectName: activeExemption2.projectName,
        status: 'ACTIVE',
        submittedAt: activeExemption2.submittedAt
      },
      {
        _id: activeExemption1._id.toString(),
        applicationReference: activeExemption1.applicationReference,
        projectName: activeExemption1.projectName,
        status: 'ACTIVE',
        submittedAt: activeExemption1.submittedAt
      }
    ])
  })

  test('does not return exemptions that have already been backfilled', async () => {
    activeExemption1 = {
      ...activeExemption1,
      areaBackfillCompleteAt: new Date().toISOString()
    }

    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertMany([activeExemption1, activeExemption2])

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/backfill-areas',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body.backfillAreas).toHaveLength(1)
    expect(body.backfillAreas[0].applicationReference).toBe(
      activeExemption2.applicationReference
    )
  })

  test('does not return when we already have values for areas', async () => {
    activeExemption1 = {
      ...activeExemption1,
      coastalOperationsAreas: [],
      marinePlanAreas: []
    }

    activeExemption2 = {
      ...activeExemption2,
      coastalOperationsAreas: [],
      marinePlanAreas: []
    }

    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertMany([activeExemption1, activeExemption2])

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/backfill-areas',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body.backfillAreas).toHaveLength(0)
    expect(body.backfillAreas).toEqual([])
  })
})
