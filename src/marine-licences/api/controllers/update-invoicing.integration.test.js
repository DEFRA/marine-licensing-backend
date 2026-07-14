import { setupTestServer } from '../../../../tests/test-server.js'
import { makePatchRequest } from '../../../../tests/server-requests.js'
import { createCompleteMarineLicence, mockUkInvoicingAddress } from '../../../../tests/test.fixture.js'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'

describe('PATCH /marine-licence/invoicing - integration tests', async () => {
  const getServer = await setupTestServer()
  const contactId = '123e4567-e89b-12d3-a456-426614174000'
  const differentContactId = '987e6543-e21b-12d3-a456-426614174000'

  const marineLicenceId = new ObjectId()




  test('successfully updates invoicing for a uk address', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      invoiceAddressType: 'uk',
      invoiceAddress: mockUkInvoicingAddress
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/invoicing',
      contactId,
      payload
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updatedLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(updatedLicence.invoicing).toEqual({
      invoiceAddressType: 'uk',
      invoiceAddress: mockUkInvoicingAddress
    })
  })

  test('successfully updates invoicing for an international address', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      invoiceAddressType: 'international',
      invoiceAddress: { addressLine1: 'test address' }
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/invoicing',
      contactId,
      payload
    })

    expect(statusCode).toBe(200)
    expect(body).toEqual({ message: 'success' })

    const updatedLicence = await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .findOne({ _id: marineLicenceId })

    expect(updatedLicence.invoicing).toEqual({
      invoiceAddressType: 'international',
      invoiceAddress: { addressLine1: 'test address' }
    })
  })

  test('returns 404 when marine licence does not exist', async () => {
    const nonExistentId = new ObjectId()

    const payload = {
      id: nonExistentId.toString(),
      invoiceAddressType: 'uk',
      invoiceAddress: mockUkInvoicingAddress
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/invoicing',
      contactId,
      payload
    })

    expect(statusCode).toBe(404)
    expect(body.message).toBe('Not Found')
  })

  test('returns 403 when attempting to update another users marine licence', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })

    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      invoiceAddressType: 'uk',
      invoiceAddress: mockUkInvoicingAddress
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/invoicing',
      contactId: differentContactId,
      payload
    })

    expect(statusCode).toBe(403)
    expect(body.message).toBe('Not authorised to request this resource')
  })

  test('returns 400 when invoiceAddressType is missing', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString()
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/invoicing',
      contactId,
      payload
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('INVOICE_ADDRESS_TYPE_REQUIRED')
  })

  test('returns 400 when invoiceAddressType is invalid', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      invoiceAddressType: 'incorrect'
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/invoicing',
      contactId,
      payload
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('INVOICE_ADDRESS_TYPE_REQUIRED')
  })

  test('returns 400 when invoiceAddressType is uk and invoiceAddress is missing', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      invoiceAddressType: 'uk'
    }

    const { statusCode } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/invoicing',
      contactId,
      payload
    })

    expect(statusCode).toBe(400)
  })

  test('returns 400 when invoiceAddressType is uk and postcode is missing', async () => {
    const marineLicence = createCompleteMarineLicence({
      _id: marineLicenceId,
      contactId
    })
    await globalThis.mockMongo
      .collection(collectionMarineLicences)
      .insertOne(marineLicence)

    const payload = {
      id: marineLicenceId.toString(),
      invoiceAddressType: 'uk',
      invoiceAddress: { ...mockUkInvoicingAddress, addressPostcode: undefined }
    }

    const { statusCode, body } = await makePatchRequest({
      server: getServer(),
      url: '/marine-licence/invoicing',
      contactId,
      payload
    })

    expect(statusCode).toBe(400)
    expect(body.message).toContain('ADDRESS_POSTCODE_REQUIRED')
  })
})
