import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { setupTestServer } from '../../../../../tests/test-server.js'
import { makeGetRequest } from '../../../../../tests/server-requests.js'
import { processMasMessage } from './worker-processor.js'
import { deleteMasMessage } from './sqs-client.js'
import { sendEmail } from '../../../../shared/helpers/email.js'
import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { mockMarineLicence } from '../../../models/test-fixtures.js'
import {
  MARINE_LICENCE_STATUS,
  WITHHOLDING_DECISION
} from '../../../constants/marine-licence.js'
import {
  mockMasApplicationReference,
  mockMasWithholdingMessageBody,
  mockMasWithholdingSqsMessage,
  mockMasWithholdingNoBasisSqsMessage
} from './test-fixtures.js'

// The real server registers the MAS worker, so only the delete is replaced.
vi.mock('./sqs-client.js', async (importOriginal) => ({
  ...(await importOriginal()),
  deleteMasMessage: vi.fn()
}))
vi.mock('../../../../shared/helpers/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue({ status: 'success', id: 'notify-id' })
}))

describe('Withholding notification end to end - integration tests', async () => {
  const getServer = await setupTestServer()

  const insertLicence = async () => {
    const _id = new ObjectId()
    await global.mockMongo.collection(collectionMarineLicences).insertOne({
      ...mockMarineLicence,
      _id,
      organisation: null,
      applicationReference: mockMasApplicationReference,
      status: MARINE_LICENCE_STATUS.SUBMITTED
    })
    return _id
  }

  const process = (message) => processMasMessage(getServer(), message)

  test('a withholding message raises a task the applicant then sees as Action required', async () => {
    const _id = await insertLicence()

    await process(mockMasWithholdingSqsMessage)

    const { applicationTasks, status } = await global.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id })

    expect(status).toBe(MARINE_LICENCE_STATUS.SUBMITTED)

    expect(applicationTasks).toHaveLength(1)
    expect(applicationTasks[0]).toMatchObject({
      type: 'WITHHOLDING_NOTIFICATION',
      resolvedAt: null
    })
    expect(applicationTasks[0].data.commercialConfidentiality).toEqual({
      decision: WITHHOLDING_DECISION.AGREE_IN_PART,
      applicantMessage: mockMasWithholdingMessageBody.commercialApplicantMessage
    })

    const { body } = await makeGetRequest({
      server: getServer(),
      url: `/marine-licence/${_id}`,
      contactId: mockMarineLicence.contactId
    })

    expect(body.status).toBe('Submitted')
    expect(body.displayStatus).toBe('Action required')
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(deleteMasMessage).toHaveBeenCalledWith(
      expect.any(String),
      mockMasWithholdingSqsMessage.ReceiptHandle
    )
  })

  test('a message with no withholding basis raises no task but is still deleted', async () => {
    const _id = await insertLicence()

    await process(mockMasWithholdingNoBasisSqsMessage)

    const licence = await global.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id })

    expect(licence.applicationTasks).toBeUndefined()
    expect(sendEmail).not.toHaveBeenCalled()
    expect(deleteMasMessage).toHaveBeenCalledWith(
      expect.any(String),
      mockMasWithholdingNoBasisSqsMessage.ReceiptHandle
    )
  })
})
