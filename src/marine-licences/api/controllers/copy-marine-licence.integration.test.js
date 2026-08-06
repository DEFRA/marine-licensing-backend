import { ObjectId } from 'mongodb'
import { setupTestServer } from '../../../../tests/test-server.js'
import { makePostRequest } from '../../../../tests/server-requests.js'
import {
  createCompleteMarineLicence,
  mockCredentials,
  mockRejectedMarineLicenceFields
} from '../../../../tests/test.fixture.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { FIELDS_TO_DROP_ON_COPY } from '../helpers/build-copied-marine-licence.js'
import { createTaskList } from '../helpers/createTaskList.js'
import { INCOMPLETE } from '../../../shared/helpers/task-list-utils.js'

describe('Copy marine licence - integration tests', async () => {
  const getServer = await setupTestServer()
  const marineLicenceId = new ObjectId()
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'
  const contactId = mockCredentials.contactId

  const {
    applicationReference,
    marinePlanPolicyJob,
    marinePlanPolicyJobId,
    marinePlanPolicies,
    marinePlanPoliciesCount,
    marinePlanPolicyResponses,
    marinePlanPolicyResponseCount
  } = mockRejectedMarineLicenceFields

  const copyRequest = ({
    contactId: requestContactId = contactId,
    payload = { id: marineLicenceId.toHexString() }
  } = {}) =>
    makePostRequest({
      server: getServer(),
      url: '/marine-licence/copy-marine-licence',
      contactId: requestContactId,
      payload
    })

  beforeEach(async () => {
    await globalThis.mockMongo.collection(collectionMarineLicences).insertOne(
      createCompleteMarineLicence({
        _id: marineLicenceId,
        contactId,
        ...mockRejectedMarineLicenceFields
      })
    )
  })

  test('successfully copies a rejected marine licence for the owner', async () => {
    const source = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    const { statusCode, body } = await copyRequest()

    expect(statusCode).toBe(201)
    expect(body).toEqual({ id: expect.any(String) })

    const copied = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: ObjectId.createFromHexString(body.id) })

    expect(copied.status).toBe(MARINE_LICENCE_STATUS.DRAFT)
    expect(copied.contactId).toBe(contactId)
    expect(copied.createdBy).toBe(contactId)
    expect(copied.updatedBy).toBe(contactId)
    expect(copied.createdAt).toBeInstanceOf(Date)
    expect(copied.updatedAt).toBeInstanceOf(Date)
    expect(copied._id.toHexString()).not.toBe(marineLicenceId.toHexString())

    for (const field of FIELDS_TO_DROP_ON_COPY.filter((f) => f !== '_id')) {
      expect(copied).not.toHaveProperty(field)
    }

    expect(copied).toMatchObject({
      projectName: source.projectName,
      siteDetails: source.siteDetails,
      marinePlanPolicyJob,
      marinePlanPolicyJobId,
      marinePlanPolicies,
      marinePlanPoliciesCount,
      marinePlanPolicyResponses,
      marinePlanPolicyResponseCount,
      feeEstimate: {
        termsAndConditions: true,
        feeBand: '2A'
      }
    })
    expect(copied.feeEstimate).not.toHaveProperty('accept')
    expect(createTaskList(copied).feeEstimate).toBe(INCOMPLETE)
    expect(source.applicationReference).toBe(applicationReference)
  })

  test('returns 403 when attempting to copy a marine licence owned by another user', async () => {
    const { statusCode, body } = await copyRequest({
      contactId: differentContactId
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to request this resource')
  })

  test('returns 400 when attempting to copy a submitted marine licence', async () => {
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOneAndUpdate(
        { _id: marineLicenceId },
        { $set: { status: MARINE_LICENCE_STATUS.SUBMITTED } }
      )

    const { statusCode, body } = await copyRequest()

    expect(statusCode).toBe(400)
    expect(body.message).toBe(
      `Cannot copy marine licence as marine licence must be the status '${MARINE_LICENCE_STATUS.REJECTED}'.`
    )
  })

  test('returns 404 when attempting to copy a non-existent marine licence', async () => {
    const { statusCode, body } = await copyRequest({
      payload: { id: new ObjectId().toHexString() }
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Not Found')
  })
})
