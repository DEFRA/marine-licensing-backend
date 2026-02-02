import { setupTestServer } from '../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../tests/server-requests.js'
import { createCompleteExemption } from '../../../../tests/test.fixture.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import { ObjectId } from 'mongodb'

describe('Get unsent EMP exemptions - integration tests', async () => {
  const getServer = await setupTestServer()

  beforeEach(async () => {
    await globalThis.mockMongo.collection(collectionExemptions).deleteMany({})
    await globalThis.mockMongo.collection('exemption-emp-queue').deleteMany({})
    await globalThis.mockMongo
      .collection('exemption-emp-queue-failed')
      .deleteMany({})
  })

  test('returns only ACTIVE exemptions sorted by submitted date (newest first)', async () => {
    const exemptionId1 = new ObjectId()
    const activeExemption1 = createCompleteExemption({
      _id: exemptionId1,
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Zebra Project',
      applicationReference: 'EXEMPTION-2024-003',
      submittedAt: '2023-01-04'
    })
    const exemptionId2 = new ObjectId()
    const activeExemption2 = createCompleteExemption({
      _id: exemptionId2,
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Alpha Project',
      applicationReference: 'EXEMPTION-2024-001',
      submittedAt: '2024-12-15'
    })
    const exemptionId3 = new ObjectId()
    const draftExemption = createCompleteExemption({
      _id: exemptionId3,
      status: EXEMPTION_STATUS.DRAFT,
      projectName: 'Draft Project',
      submittedAt: '2025-06-10'
    })
    const exemptionId4 = new ObjectId()
    const activeExemption3 = createCompleteExemption({
      _id: exemptionId4,
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Mango Project',
      applicationReference: 'EXEMPTION-2024-002',
      submittedAt: '2026-01-15'
    })

    await globalThis.mockMongo
      .collection(collectionExemptions)
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
    expect(body.unsentExemptions).toHaveLength(3)
    expect(body.failedPendingRetries).toEqual([])

    // Verify only ACTIVE exemptions are returned
    expect(body.unsentExemptions).toEqual([
      {
        _id: exemptionId4.toString(),
        applicationReference: 'EXEMPTION-2024-002',
        projectName: 'Mango Project',
        status: 'ACTIVE',
        submittedAt: '2026-01-15',
        previouslyFailedAt: null
      },
      {
        _id: exemptionId2.toString(),
        applicationReference: 'EXEMPTION-2024-001',
        projectName: 'Alpha Project',
        status: 'ACTIVE',
        submittedAt: '2024-12-15',
        previouslyFailedAt: null
      },
      {
        _id: exemptionId1.toString(),
        applicationReference: 'EXEMPTION-2024-003',
        projectName: 'Zebra Project',
        status: 'ACTIVE',
        submittedAt: '2023-01-04',
        previouslyFailedAt: null
      }
    ])

    const submittedDates = body.unsentExemptions.map(
      (exemption) => exemption.submittedAt
    )
    expect(submittedDates).toEqual(['2026-01-15', '2024-12-15', '2023-01-04'])
  })

  test('returns empty array when no ACTIVE exemptions exist', async () => {
    const draftExemption = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.DRAFT,
      projectName: 'Draft Project'
    })

    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(draftExemption)

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/send-to-emp',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body.unsentExemptions).toEqual([])
    expect(body.failedPendingRetries).toEqual([])
  })

  test('returns empty array when no exemptions exist', async () => {
    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/send-to-emp',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body.unsentExemptions).toEqual([])
    expect(body.failedPendingRetries).toEqual([])
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
      .collection(collectionExemptions)
      .insertOne(minimalExemption)

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/send-to-emp',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body.unsentExemptions).toHaveLength(1)
    expect(body.unsentExemptions[0].projectName).toBe('Minimal Project')
    expect(body.unsentExemptions[0].previouslyFailedAt).toBeNull()
  })

  test('filters out exemptions that are already in the EMP queue', async () => {
    const queuedExemption = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Queued Project',
      applicationReference: 'EXEMPTION-2024-001'
    })

    const unqueuedId = new ObjectId()
    const unqueuedExemption = createCompleteExemption({
      _id: unqueuedId,
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Unqueued Project',
      applicationReference: 'EXEMPTION-2024-002'
    })

    // Insert both exemptions
    await globalThis.mockMongo
      .collection(collectionExemptions)
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
    expect(body.unsentExemptions).toHaveLength(1)
    expect(body.unsentExemptions[0]._id).toBe(unqueuedId.toString())
    expect(body.unsentExemptions[0].applicationReference).toBe(
      'EXEMPTION-2024-002'
    )
    expect(body.unsentExemptions[0].projectName).toBe('Unqueued Project')
    expect(body.unsentExemptions[0].status).toBe('ACTIVE')
    expect(body.unsentExemptions[0].previouslyFailedAt).toBeNull()
    expect(body.failedPendingRetries).toEqual([])
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
      .collection(collectionExemptions)
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
    expect(body.unsentExemptions).toEqual([])
    expect(body.failedPendingRetries).toEqual([])
  })

  test('does not return exemptions that have failed to send and are retrying', async () => {
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
      .collection(collectionExemptions)
      .insertMany([exemption1, exemption2, exemption3])

    // Add one to queue with failed status - should still be filtered out
    await globalThis.mockMongo.collection('exemption-emp-queue').insertOne({
      applicationReferenceNumber: 'EXEMPTION-2024-002',
      status: 'failed',
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
    expect(body.unsentExemptions).toHaveLength(2)
    expect(body.unsentExemptions[0].projectName).toBe('Alpha Project')
    expect(body.unsentExemptions[1].projectName).toBe('Gamma Project')
    // Beta Project should be filtered out even though it has failed status in queue
    expect(
      body.unsentExemptions.find((e) => e.projectName === 'Beta Project')
    ).toBeUndefined()
    expect(body.failedPendingRetries).toEqual([
      { applicationReference: 'EXEMPTION-2024-002', retries: 2 }
    ])
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
      .collection(collectionExemptions)
      .insertMany([exemptionWithRef, exemptionWithoutRef])

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/send-to-emp',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body.unsentExemptions).toHaveLength(2)
    expect(body.unsentExemptions.map((e) => e.projectName)).toContain(
      'With Reference'
    )
    expect(body.unsentExemptions.map((e) => e.projectName)).toContain(
      'Without Reference'
    )
  })

  test('includes previouslyFailedAt for exemptions with failed history', async () => {
    const failedDate = new Date('2024-01-10T15:30:00Z')
    const exemption = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Previously Failed Project',
      applicationReference: 'EXEMPTION-2024-001',
      submittedAt: '2024-01-15'
    })

    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(exemption)

    // Add failed queue item
    await globalThis.mockMongo
      .collection('exemption-emp-queue-failed')
      .insertOne({
        applicationReferenceNumber: 'EXEMPTION-2024-001',
        status: 'failed',
        retries: 3,
        createdAt: new Date(),
        updatedAt: failedDate
      })

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/send-to-emp',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body.unsentExemptions).toHaveLength(1)
    expect(body.unsentExemptions[0].previouslyFailedAt).toBe(
      failedDate.toISOString()
    )
  })

  test('uses most recent failure date when multiple failed records exist', async () => {
    const olderFailedDate = new Date('2024-01-10T15:30:00Z')
    const newerFailedDate = new Date('2024-01-15T10:00:00Z')
    const exemption = createCompleteExemption({
      _id: new ObjectId(),
      status: EXEMPTION_STATUS.ACTIVE,
      projectName: 'Multiple Failures Project',
      applicationReference: 'EXEMPTION-2024-001',
      submittedAt: '2024-01-20'
    })

    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(exemption)

    // Add multiple failed queue items
    await globalThis.mockMongo
      .collection('exemption-emp-queue-failed')
      .insertMany([
        {
          applicationReferenceNumber: 'EXEMPTION-2024-001',
          status: 'failed',
          retries: 3,
          createdAt: new Date(),
          updatedAt: olderFailedDate
        },
        {
          applicationReferenceNumber: 'EXEMPTION-2024-001',
          status: 'failed',
          retries: 3,
          createdAt: new Date(),
          updatedAt: newerFailedDate
        }
      ])

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/send-to-emp',
      isInternalUser: true
    })

    expect(statusCode).toBe(200)
    expect(body.unsentExemptions).toHaveLength(1)
    expect(body.unsentExemptions[0].previouslyFailedAt).toBe(
      newerFailedDate.toISOString()
    )
  })
})
