import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { setupTestServer } from '../../../../../tests/test-server.js'
import { processMasMessage } from './worker-processor.js'
import { deleteMasMessage } from './sqs-client.js'
import { sendEmail } from '../../../../shared/helpers/email.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { mockMarineLicence } from '../../../models/test-fixtures.js'
import {
  APPLICATION_TASK_TYPE,
  MARINE_LICENCE_STATUS,
  MAS_EVENT_ACTION
} from '../../../constants/marine-licence.js'
import {
  mockMasApplicationReference,
  mockMasSiteNoticeEvidenceRejectionMessageBody,
  mockMasSiteNoticeEvidenceRejectionSqsMessage,
  mockMasUserEmail,
  mockMasUserName
} from './test-fixtures.js'

vi.mock('./sqs-client.js', async (importOriginal) => ({
  ...(await importOriginal()),
  deleteMasMessage: vi.fn()
}))
vi.mock('../../../../shared/helpers/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue({ status: 'success', id: 'notify-id' })
}))

const RESUBMIT = APPLICATION_TASK_TYPE.RESUBMIT_SITE_NOTICE_EVIDENCE

const resolvedSiteNoticeTask = {
  taskId: new ObjectId().toHexString(),
  type: APPLICATION_TASK_TYPE.PUBLIC_SITE_NOTICE,
  receivedAt: new Date('2026-09-01T10:00:00.000Z'),
  resolvedAt: new Date('2026-09-10T10:00:00.000Z'),
  resolvedBy: mockMarineLicence.contactId,
  sourceMessageId: 'site-notice-message',
  data: {}
}

const evidence = (locationName) => ({
  locationName,
  dateDisplayed: { day: '1', month: '9', year: '2026' }
})

describe('Site notice evidence rejection end to end - integration tests', async () => {
  const getServer = await setupTestServer()

  const collection = () => global.mockMongo.collection(collectionMarineLicences)

  const insertLicence = async (fields = {}) => {
    const _id = new ObjectId()
    await collection().insertOne({
      ...mockMarineLicence,
      _id,
      organisation: null,
      applicationReference: mockMasApplicationReference,
      status: MARINE_LICENCE_STATUS.SUBMITTED,
      applicationTasks: [resolvedSiteNoticeTask],
      siteNoticeEvidence: [
        evidence('Harbour board'),
        evidence('Beach car park'),
        evidence('Yacht club')
      ],
      ...fields
    })
    return _id
  }

  const stored = (_id) => collection().findOne({ _id })

  const resubmitTasksOf = async (_id) =>
    (await stored(_id)).applicationTasks.filter(({ type }) => type === RESUBMIT)

  const messageWith = (body, MessageId = 'rejection-message') => ({
    ...mockMasSiteNoticeEvidenceRejectionSqsMessage,
    MessageId,
    Body: JSON.stringify({
      ...mockMasSiteNoticeEvidenceRejectionMessageBody,
      ...body
    })
  })

  const process = (message = messageWith({})) =>
    processMasMessage(getServer(), message)

  test('raises a task holding each rejected location and its reason in location order', async () => {
    const _id = await insertLicence()

    await process()

    const [task] = await resubmitTasksOf(_id)
    expect(task).toMatchObject({
      resolvedAt: null,
      sourceMessageId: 'rejection-message',
      data: {
        locations: [
          {
            locationNumber: 1,
            reason:
              'The close-up photo is blurred, so we cannot read the notice.'
          },
          {
            locationNumber: 3,
            reason: 'The position photo does not show where the notice is.'
          }
        ]
      }
    })
  })

  test('moves the application to Action required and records the status it had', async () => {
    const _id = await insertLicence()

    await process()

    expect(await stored(_id)).toMatchObject({
      status: MARINE_LICENCE_STATUS.ACTION_REQUIRED,
      previousStatus: MARINE_LICENCE_STATUS.SUBMITTED
    })
  })

  test('leaves the original site notice evidence untouched', async () => {
    const _id = await insertLicence()
    const before = (await stored(_id)).siteNoticeEvidence

    await process()

    expect((await stored(_id)).siteNoticeEvidence).toEqual(before)
  })

  test('emails the applicant a link to the view details page and deletes the message', async () => {
    const _id = await insertLicence()

    await process()

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: mockMasUserEmail,
        applicationReference: mockMasApplicationReference,
        personalisation: {
          name: mockMasUserName,
          applicationReference: mockMasApplicationReference,
          viewDetailsUrl: expect.stringMatching(
            new RegExp(`/marine-licence/view-details/${_id}$`)
          )
        }
      })
    )
    expect(deleteMasMessage).toHaveBeenCalledWith(
      expect.any(String),
      mockMasSiteNoticeEvidenceRejectionSqsMessage.ReceiptHandle
    )
  })

  test('a redelivered message creates no second task and sends no second email', async () => {
    const _id = await insertLicence()

    await process()
    await process()

    expect(await resubmitTasksOf(_id)).toHaveLength(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  test('a redelivery after the applicant has resubmitted does not raise the task again', async () => {
    const _id = await insertLicence()
    await process()
    await collection().updateOne(
      { _id },
      { $set: { 'applicationTasks.1.resolvedAt': new Date() } }
    )

    await process()

    expect(await resubmitTasksOf(_id)).toHaveLength(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  test('a later rejection adds a second round and keeps the first', async () => {
    const _id = await insertLicence()
    await process()
    await collection().updateOne(
      { _id },
      { $set: { 'applicationTasks.1.resolvedAt': new Date() } }
    )

    await process(
      messageWith(
        { rejectedLocations: [{ locationNumber: 2, reason: 'Too dark' }] },
        'second-rejection-message'
      )
    )

    const [first, second] = await resubmitTasksOf(_id)
    expect(first.resolvedAt).toEqual(expect.any(Date))
    expect(first.data.locations.map((l) => l.locationNumber)).toEqual([1, 3])
    expect(second).toMatchObject({
      resolvedAt: null,
      data: { locations: [{ locationNumber: 2, reason: 'Too dark' }] }
    })
    expect(sendEmail).toHaveBeenCalledTimes(2)
  })

  test('refuses a second rejection while the first is still outstanding', async () => {
    const _id = await insertLicence()
    await process()

    await process(messageWith({}, 'second-rejection-message'))

    expect(await resubmitTasksOf(_id)).toHaveLength(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  test('raises the task but sends no email when the message has no recipient', async () => {
    const _id = await insertLicence()

    await process(messageWith({ userEmail: null }))

    expect(await resubmitTasksOf(_id)).toHaveLength(1)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  test('deletes the message when no licence has the reference', async () => {
    await process()

    expect(sendEmail).not.toHaveBeenCalled()
    expect(deleteMasMessage).toHaveBeenCalled()
  })

  describe('a message that cannot be processed', () => {
    test.each([
      ['has no rejected locations', { rejectedLocations: [] }],
      [
        'has a location with no reason',
        { rejectedLocations: [{ locationNumber: 1 }] }
      ],
      [
        'repeats a location',
        {
          rejectedLocations: [
            { locationNumber: 1, reason: 'a' },
            { locationNumber: 1, reason: 'b' }
          ]
        }
      ],
      [
        'names a location the applicant never sent',
        { rejectedLocations: [{ locationNumber: 4, reason: 'a' }] }
      ]
    ])('is logged and discarded when it %s', async (_case, body) => {
      const _id = await insertLicence()
      const logWarn = vi.spyOn(getServer().logger, 'warn')

      await process(messageWith(body))

      expect(logWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            action: MAS_EVENT_ACTION.APPLICATION_TASK_SKIPPED,
            reference: mockMasApplicationReference
          })
        }),
        expect.stringContaining('Discarding site notice evidence rejection')
      )
      expect(await resubmitTasksOf(_id)).toHaveLength(0)
      expect((await stored(_id)).status).toBe(MARINE_LICENCE_STATUS.SUBMITTED)
      expect(sendEmail).not.toHaveBeenCalled()
      expect(deleteMasMessage).toHaveBeenCalled()
    })

    test('is discarded when the applicant has not sent evidence yet', async () => {
      const _id = await insertLicence({
        applicationTasks: [{ ...resolvedSiteNoticeTask, resolvedAt: null }]
      })
      const logWarn = vi.spyOn(getServer().logger, 'warn')

      await process()

      expect(logWarn).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining(
          'the applicant has not sent any site notice evidence'
        )
      )
      expect(await resubmitTasksOf(_id)).toHaveLength(0)
      expect(deleteMasMessage).toHaveBeenCalled()
    })
  })
})
