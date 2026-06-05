import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import {
  createCompleteMarineLicence,
  mockWaterFrameworkDirective
} from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

describe('PATCH /marine-licence/water-framework-directive - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'
  const marineLicenceId = new ObjectId()

  test('successfully updates water framework directive with nauticalMile yes', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId,
      waterFrameworkDirective: { nauticalMile: 'no' }
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      waterFrameworkDirective: mockWaterFrameworkDirective
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/water-framework-directive',
      contactId,
      payload
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updatedLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(updatedLicence.waterFrameworkDirective).toEqual({
      excludedActivities: 'no',
      nauticalMile: 'yes',
      previousAssessment: 'no'
    })
  })

  test('successfully updates water framework directive with nauticalMile no', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      waterFrameworkDirective: { nauticalMile: 'no' }
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/water-framework-directive',
      contactId,
      payload
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updatedLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(updatedLicence.waterFrameworkDirective).toEqual({
      nauticalMile: 'no'
    })
  })

  test('returns 404 when marine licence does not exist', async () => {
    const nonExistentId = new ObjectId()

    const payload = {
      id: nonExistentId.toString(),
      waterFrameworkDirective: mockWaterFrameworkDirective
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/water-framework-directive',
      contactId,
      payload
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Not Found')
  })

  test('returns 403 when attempting to update another users marine licence', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId,
      waterFrameworkDirective: { nauticalMile: 'no' }
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      waterFrameworkDirective: mockWaterFrameworkDirective
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/water-framework-directive',
      contactId: differentContactId,
      payload
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to request this resource')

    const unchangedLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(unchangedLicence.waterFrameworkDirective.nauticalMile).toBe('no')
  })

  test('returns 400 when nauticalMile is missing', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      waterFrameworkDirective: {}
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/water-framework-directive',
      contactId,
      payload
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('NAUTICAL_MILE_REQUIRED')
  })
})
