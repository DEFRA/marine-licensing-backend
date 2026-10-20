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
  mockMasResubmitSiteNoticeEvidenceMessageBody,
  mockMasResubmitSiteNoticeEvidenceSqsMessage,
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

describe('Resubmit site notice evidence request end to end - integration tests', async () => {
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

  const messageWith = (body, MessageId = 'resubmit-request-message') => ({
    ...mockMasResubmitSiteNoticeEvidenceSqsMessage,
    MessageId,
    Body: JSON.stringify({
      ...mockMasResubmitSiteNoticeEvidenceMessageBody,
      ...body
    })
  })

  const process = (message = messageWith({})) =>
    processMasMessage(getServer(), message)

  test('raises a task holding each rejected location, emails the applicant and deletes the message', async () => {
    const _id = await insertLicence()
    const evidenceBefore = (await stored(_id)).siteNoticeEvidence

    await process(
      messageWith({
        rejectedLocations:
          mockMasResubmitSiteNoticeEvidenceMessageBody.rejectedLocations.map(
            (location) => ({ ...location, caseworkerNote: 'internal' })
          )
      })
    )

    const [task] = await resubmitTasksOf(_id)
    expect(task).toMatchObject({
      resolvedAt: null,
      sourceMessageId: 'resubmit-request-message'
    })
    expect(task.data.locations).toEqual([
      {
        locationNumber: 1,
        reason: 'The close-up photo is blurred, so we cannot read the notice.'
      },
      {
        locationNumber: 3,
        reason: 'The position photo does not show where the notice is.'
      }
    ])
    expect((await stored(_id)).siteNoticeEvidence).toEqual(evidenceBefore)
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
      mockMasResubmitSiteNoticeEvidenceSqsMessage.ReceiptHandle
    )
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

  test('a later request adds a second round and keeps the first', async () => {
    const _id = await insertLicence()
    await process()
    await collection().updateOne(
      { _id },
      { $set: { 'applicationTasks.1.resolvedAt': new Date() } }
    )

    await process(
      messageWith(
        { rejectedLocations: [{ locationNumber: 2, reason: 'Too dark' }] },
        'second-resubmit-request-message'
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

  test('refuses a second request while the first is still outstanding', async () => {
    const _id = await insertLicence()
    await process()

    await process(messageWith({}, 'second-resubmit-request-message'))

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

  test.each([
    [
      'has no rejected locations',
      { rejectedLocations: [] },
      {},
      '"rejectedLocations" must contain at least 1 items'
    ],
    [
      'names a location the applicant never sent',
      { rejectedLocations: [{ locationNumber: 4, reason: 'a' }] },
      {},
      'no evidence location 4 among the 3 sent'
    ],
    [
      'arrives for a licence with no site notice evidence',
      { rejectedLocations: [{ locationNumber: 1, reason: 'a' }] },
      { siteNoticeEvidence: undefined },
      'no evidence location 1 among the 0 sent'
    ],
    [
      'arrives before the applicant has sent evidence',
      {},
      { applicationTasks: [{ ...resolvedSiteNoticeTask, resolvedAt: null }] },
      'the applicant has not sent any site notice evidence'
    ],
    [
      'arrives for a licence with no application tasks',
      {},
      { applicationTasks: undefined },
      'the applicant has not sent any site notice evidence'
    ]
  ])(
    'a message is logged and discarded when it %s',
    async (_case, body, licenceFields, reason) => {
      const _id = await insertLicence(licenceFields)
      const logWarn = vi.spyOn(getServer().logger, 'warn')

      await process(messageWith(body))

      expect(logWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            action: MAS_EVENT_ACTION.APPLICATION_TASK_SKIPPED,
            reference: mockMasApplicationReference
          })
        }),
        expect.stringContaining(
          `Discarding resubmit site notice evidence request for applicationReference ${mockMasApplicationReference}: ${reason}`
        )
      )
      const licence = await stored(_id)
      expect(
        (licence.applicationTasks ?? []).filter(({ type }) => type === RESUBMIT)
      ).toHaveLength(0)
      expect(licence.status).toBe(MARINE_LICENCE_STATUS.SUBMITTED)
      expect(sendEmail).not.toHaveBeenCalled()
      expect(deleteMasMessage).toHaveBeenCalled()
    }
  )
})
