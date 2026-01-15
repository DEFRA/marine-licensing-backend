import { setupTestServer } from '../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../tests/server-requests.js'
import { createCompleteExemption } from '../../../../tests/test.fixture.js'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'
import { ObjectId } from 'mongodb'

describe('Get unsent EMP exemptions - integration tests', async () => {
  const getServer = await setupTestServer()

  beforeEach(async () => {
    await globalThis.mockMongo.collection('exemptions').deleteMany({})
    await globalThis.mockMongo.collection('exemption-emp-queue').deleteMany({})
  })

  test('returns only ACTIVE exemptions sorted by submitted date (newest first)', async () => {
    // Create exemptions with different statuses
    const activeExemption1 = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Zebra Project',
      applicationReference: 'EXEMPTION-2024-003',
      submittedAt: '2023-01-04'
    })

    const activeExemption2 = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Alpha Project',
      applicationReference: 'EXEMPTION-2024-001',
      submittedAt: '2024-12-15'
    })

    const draftExemption = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.DRAFT,
      projectName: 'Draft Project',
      submittedAt: '2025-06-10'
    })

    const activeExemption3 = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Mango Project',
      applicationReference: 'EXEMPTION-2024-002',
      submittedAt: '2026-01-15'
    })

    await globalThis.mockMongo
      .collection('exemptions')
      .insertMany([
        activeExemption1,
        activeExemption2,
        draftExemption,
        activeExemption3
      ])

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/send-to-emp',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body).toHaveLength(3)

    // Verify only ACTIVE exemptions are returned
    expect(body.every((exemption) => exemption.status === 'ACTIVE')).toBe(true)

    const submittedDates = body.map((exemption) => exemption.submittedAt)
    expect(submittedDates).toEqual(['2026-01-15', '2024-12-15', '2023-01-04'])
  })

  test('returns empty array when no ACTIVE exemptions exist', async () => {
    const draftExemption = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.DRAFT,
      projectName: 'Draft Project'
    })

    await globalThis.mockMongo
      .collection('exemptions')
      .insertOne(draftExemption)

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/send-to-emp',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual([])
  })

  test('returns empty array when no exemptions exist', async () => {
    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/send-to-emp',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual([])
  })

  test('returns all fields for each exemption', async () => {
    const exemption = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Complete Project',
      applicationReference: 'EXEMPTION-2024-001',
      organisation: {
        id: 'org-123',
        name: 'Test Organisation'
      }
    })

    await globalThis.mockMongo.collection('exemptions').insertOne(exemption)

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/send-to-emp',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body).toHaveLength(1)

    const returnedExemption = body[0]

    // Verify all expected fields are present
    expect(returnedExemption._id).toBe(exemption._id.toString())
    expect(returnedExemption.projectName).toBe('Complete Project')
    expect(returnedExemption.applicationReference).toBe('EXEMPTION-2024-001')
    expect(returnedExemption.status).toBe('ACTIVE')
    expect(returnedExemption.organisation).toEqual({
      id: 'org-123',
      name: 'Test Organisation'
    })
    expect(returnedExemption.contactId).toBe(exemption.contactId)
    expect(returnedExemption.siteDetails).toBeDefined()
    expect(returnedExemption.publicRegister).toBeDefined()
  })

  test('handles exemptions without optional fields', async () => {
    const minimalExemption = {
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Minimal Project',
      contactId: 'contact-123',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await globalThis.mockMongo
      .collection('exemptions')
      .insertOne(minimalExemption)

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/send-to-emp',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].projectName).toBe('Minimal Project')
  })

  test('filters out exemptions that are already in the EMP queue', async () => {
    const queuedExemption = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Queued Project',
      applicationReference: 'EXEMPTION-2024-001'
    })

    const unqueuedExemption = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Unqueued Project',
      applicationReference: 'EXEMPTION-2024-002'
    })

    // Insert both exemptions
    await globalThis.mockMongo
      .collection('exemptions')
      .insertMany([queuedExemption, unqueuedExemption])

    // Add one to the queue
    await globalThis.mockMongo.collection('exemption-emp-queue').insertOne({
      applicationReferenceNumber: 'EXEMPTION-2024-001',
      status: 'PENDING',
      retries: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/send-to-emp',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].projectName).toBe('Unqueued Project')
    expect(body[0].applicationReference).toBe('EXEMPTION-2024-002')
  })

  test('returns empty array when all ACTIVE exemptions are in the queue', async () => {
    const exemption1 = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Project 1',
      applicationReference: 'EXEMPTION-2024-001'
    })

    const exemption2 = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Project 2',
      applicationReference: 'EXEMPTION-2024-002'
    })

    // Insert exemptions
    await globalThis.mockMongo
      .collection('exemptions')
      .insertMany([exemption1, exemption2])

    // Add both to the queue
    await globalThis.mockMongo.collection('exemption-emp-queue').insertMany([
      {
        applicationReferenceNumber: 'EXEMPTION-2024-001',
        status: 'PENDING',
        retries: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        applicationReferenceNumber: 'EXEMPTION-2024-002',
        status: 'SUCCESS',
        retries: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ])

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/send-to-emp',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual([])
  })

  test('returns exemptions regardless of queue item status', async () => {
    const exemption1 = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Alpha Project',
      applicationReference: 'EXEMPTION-2024-001'
    })

    const exemption2 = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Beta Project',
      applicationReference: 'EXEMPTION-2024-002'
    })

    const exemption3 = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Gamma Project',
      applicationReference: 'EXEMPTION-2024-003'
    })

    // Insert exemptions
    await globalThis.mockMongo
      .collection('exemptions')
      .insertMany([exemption1, exemption2, exemption3])

    // Add one to queue with FAILED status - should still be filtered out
    await globalThis.mockMongo.collection('exemption-emp-queue').insertOne({
      applicationReferenceNumber: 'EXEMPTION-2024-002',
      status: 'FAILED',
      retries: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/send-to-emp',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body).toHaveLength(2)
    expect(body[0].projectName).toBe('Alpha Project')
    expect(body[1].projectName).toBe('Gamma Project')
    // Beta Project should be filtered out even though it has FAILED status in queue
    expect(body.find((e) => e.projectName === 'Beta Project')).toBeUndefined()
  })

  test('handles exemptions without applicationReference gracefully', async () => {
    const exemptionWithRef = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'With Reference',
      applicationReference: 'EXEMPTION-2024-001'
    })

    const exemptionWithoutRef = {
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Without Reference',
      contactId: 'contact-123',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await globalThis.mockMongo
      .collection('exemptions')
      .insertMany([exemptionWithRef, exemptionWithoutRef])

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/send-to-emp',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body).toHaveLength(2)
    expect(body.map((e) => e.projectName)).toContain('With Reference')
    expect(body.map((e) => e.projectName)).toContain('Without Reference')
  })
})
