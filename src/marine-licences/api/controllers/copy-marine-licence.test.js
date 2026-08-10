import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { copyMarineLicenceController } from './copy-marine-licence.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import {
  createCompleteMarineLicence,
  mockCredentials
} from '../../../../tests/test.fixture.js'

describe('POST /marine-licence/copy-marine-licence', () => {
  const payloadValidator = copyMarineLicenceController.options.validate.payload
  const mockId = new ObjectId().toHexString()
  const mockAuth = {
    credentials: mockCredentials,
    artifacts: { decoded: {} }
  }

  const callHandler = () => {
    const { mockMongo, mockHandler } = global
    return copyMarineLicenceController.handler(
      {
        db: mockMongo,
        auth: mockAuth,
        payload: { id: mockId }
      },
      mockHandler
    )
  }

  it('should fail if id is missing', () => {
    const result = payloadValidator.validate({})

    expect(result.error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
  })

  it('should fail if id has incorrect length', () => {
    const result = payloadValidator.validate({ id: '123' })

    expect(result.error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
  })

  it('should fail if id has incorrect characters', () => {
    const result = payloadValidator.validate({ id: 'g'.repeat(24) })

    expect(result.error.message).toContain('MARINE_LICENCE_ID_INVALID')
  })

  it('should insert a copied draft and return the new id', async () => {
    const { mockMongo, mockHandler } = global
    const source = createCompleteMarineLicence({
      _id: ObjectId.createFromHexString(mockId),
      contactId: mockCredentials.contactId,
      status: MARINE_LICENCE_STATUS.REJECTED,
      applicationReference: 'MLA/2026/10002'
    })
    const insertedId = new ObjectId()
    const mockInsertOne = vi.fn().mockResolvedValueOnce({ insertedId })

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOne: vi.fn().mockResolvedValue(source),
        insertOne: mockInsertOne
      }
    })

    await callHandler()

    expect(mockHandler.response).toHaveBeenCalledWith({
      message: 'success',
      value: { id: insertedId.toString() }
    })
    expect(mockInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MARINE_LICENCE_STATUS.DRAFT,
        contactId: mockCredentials.contactId,
        createdBy: mockCredentials.contactId,
        updatedBy: mockCredentials.contactId,
        projectName: source.projectName
      })
    )
    expect(mockInsertOne.mock.calls[0][0].createdAt).toBeInstanceOf(Date)
    expect(mockInsertOne.mock.calls[0][0].updatedAt).toBeInstanceOf(Date)
    expect(mockInsertOne.mock.calls[0][0]).not.toHaveProperty(
      'applicationReference'
    )
  })

  it('should return 400 when marine licence is not rejected', async () => {
    const { mockMongo } = global
    const source = createCompleteMarineLicence({
      _id: ObjectId.createFromHexString(mockId),
      contactId: mockCredentials.contactId,
      status: MARINE_LICENCE_STATUS.DRAFT
    })

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOne: vi.fn().mockResolvedValue(source)
      }
    })

    await expect(() => callHandler()).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 400 }
    })
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo } = global
    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        findOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() => callHandler()).rejects.toThrow(
      `Error copying marine licence: ${mockError}`
    )
  })
})
