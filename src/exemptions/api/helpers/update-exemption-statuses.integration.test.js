import { vi } from 'vitest'
import { setupTestServer } from '../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../tests/server-requests.js'
import { config } from '../../../config.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import {
  collectionExemptions,
  collectionEmpQueue
} from '../../../shared/common/constants/db-collections.js'
import {
  EMP_REQUEST_ACTIONS,
  REQUEST_QUEUE_STATUS
} from '../../../shared/common/constants/request-queue.js'

describe('exemption-status job - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'

  // Ends before today, so the job moves it from Active to Expired.
  const expiringExemption = (applicationReference) => ({
    applicationReference,
    projectName: applicationReference,
    status: EXEMPTION_STATUS.ACTIVE,
    submittedAt: new Date('2026-07-01T00:00:00.000Z'),
    siteDetails: [
      {
        activityDates: {
          start: new Date('2026-07-01T00:00:00.000Z'),
          end: new Date('2026-07-31T00:00:00.000Z')
        }
      }
    ]
  })

  const alreadyInEmp = (applicationReference) => ({
    applicationReferenceNumber: applicationReference,
    action: EMP_REQUEST_ACTIONS.ADD,
    status: REQUEST_QUEUE_STATUS.SUCCESS,
    empFeatureIds: ['emp-object-id']
  })

  const queuedStatusUpdates = async () =>
    (
      await globalThis.mockMongo
        .collection(collectionEmpQueue)
        .find({ action: EMP_REQUEST_ACTIONS.UPDATE_STATUS })
        .toArray()
    ).map((row) => row.applicationReferenceNumber)

  let configGetSpy

  beforeEach(async () => {
    await globalThis.mockMongo.collection(collectionExemptions).deleteMany({})
    await globalThis.mockMongo.collection(collectionEmpQueue).deleteMany({})

    const actualGet = config.get.bind(config)
    configGetSpy = vi
      .spyOn(config, 'get')
      .mockImplementation((key) =>
        key === 'exploreMarinePlanning'
          ? { ...actualGet(key), isEmpEnabled: true }
          : actualGet(key)
      )

    getServer().methods.processEmpQueue = vi.fn().mockResolvedValue(undefined)
  })

  afterEach(() => {
    configGetSpy.mockRestore()
  })

  test('queues an EMP status update only for the exemption already in EMP', async () => {
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertMany([
        expiringExemption('IN-EMP'),
        expiringExemption('NEVER-SENT')
      ])
    await globalThis.mockMongo
      .collection(collectionEmpQueue)
      .insertOne(alreadyInEmp('IN-EMP'))

    await getServer().methods.runSchedulerExemptionStatus()

    expect(await queuedStatusUpdates()).toEqual(['IN-EMP'])

    const updated = await globalThis.mockMongo
      .collection(collectionExemptions)
      .findOne({ applicationReference: 'IN-EMP' })
    expect(updated.status).toBe(EXEMPTION_STATUS.EXPIRED)
  })

  test('leaves the never-sent exemption visible to the unsent-exemptions screen', async () => {
    await globalThis.mockMongo
      .collection(collectionExemptions)
      .insertOne(expiringExemption('NEVER-SENT'))

    await getServer().methods.runSchedulerExemptionStatus()

    const { statusCode, body } = await makeGetRequest({
      server: getServer(),
      url: '/exemptions/send-to-emp',
      contactId
    })

    expect(statusCode).toBe(200)
    expect(
      body.unsentExemptions.map((row) => row.applicationReference)
    ).toContain('NEVER-SENT')
  })
})
