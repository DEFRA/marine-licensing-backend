import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { createCompleteMarineLicence } from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

describe('PATCH /marine-licence/marine-plan-policy-response - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const response =
    'Our activity complies with this policy because it avoids sensitive habitats.'

  test('stores the response and requiresDocumentation, counting only non-empty responses', async () => {
    const marineLicenceId = new ObjectId()
    await globalThis.mockMongo.collection(collectionMarineLicences).insertOne(
      createCompleteMarineLicence({
        _id: marineLicenceId,
        contactId,
        marinePlanPolicyResponses: {
          'EXISTING-1': { response, requiresDocumentation: false },
          'EXISTING-2': { response: '', requiresDocumentation: false }
        },
        marinePlanPolicyResponseCount: 1
      })
    )

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/marine-plan-policy-response',
      contactId,
      payload: {
        id: marineLicenceId.toString(),
        policyCode: 'NEW-1',
        response,
        requiresDocumentation: true
      }
    })

    expect(statusCode).toBe(200)

    const licence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(licence.marinePlanPolicyResponses).toEqual({
      'EXISTING-1': { response, requiresDocumentation: false },
      'EXISTING-2': { response: '', requiresDocumentation: false },
      'NEW-1': { response, requiresDocumentation: true }
    })
    expect(licence.marinePlanPolicyResponseCount).toBe(2)
  })

  test.each([`$${response}`, `$$${response}`])(
    'stores a response starting with $ verbatim: %s',
    async (dollarResponse) => {
      const marineLicenceId = new ObjectId()
      await globalThis.mockMongo
        .collection(collectionMarineLicences)
        .insertOne(
          createCompleteMarineLicence({ _id: marineLicenceId, contactId })
        )

      const { statusCode } = await makePatchRequest({
        server: getServer(),
        url: '/marine-licence/marine-plan-policy-response',
        contactId,
        payload: {
          id: marineLicenceId.toString(),
          policyCode: 'NEW-1',
          response: dollarResponse
        }
      })

      expect(statusCode).toBe(200)

      const licence = await globalThis.mockMongo
        .collection(collectionMarineLicences)
        .findOne({ _id: marineLicenceId })

      expect(licence.marinePlanPolicyResponses['NEW-1']).toEqual({
        response: dollarResponse,
        requiresDocumentation: false
      })
    }
  )
})
