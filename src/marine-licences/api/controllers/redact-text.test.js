import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { redactTextController } from './redact-text.js'
import { validateWfdUpload } from '../helpers/validateWfdUpload.js'
import { validateConstructionDrawingUpload } from '../helpers/validateConstructionDrawingUpload.js'
import {
  redactText,
  WITHHOLD_LOCATION_FIELD
} from '../../models/redact-text.js'
import { mockRedactions } from '../../../../tests/test.fixture.js'

vi.mock('../helpers/validateWfdUpload.js', () => ({
  validateWfdUpload: vi.fn()
}))
vi.mock('../helpers/validateConstructionDrawingUpload.js', () => ({
  validateConstructionDrawingUpload: vi.fn()
}))

describe('POST /marine-licence/redact-text', () => {
  const mockS3Location = {
    s3Bucket: 'mmo-uploads',
    s3Key: 'redactions/abc-123',
    checksumSha256: 'V3nR8yISvb6pfVp1g1eUdFo5Cer80JpGlqkGAJb/O8k='
  }

  const { redactedAt, redactedBy, redactedText } = mockRedactions.preferredDates

  const mockAuditPayload = {
    updatedAt: redactedAt,
    updatedBy: 'should-not-be-used'
  }

  const entraAuth = {
    credentials: { contactId: redactedBy },
    artifacts: { decoded: { tid: 'abc', oid: redactedBy } }
  }

  const defraIdAuth = {
    credentials: { contactId: 'applicant123' },
    artifacts: { decoded: { contactId: 'applicant123' } }
  }

  const createPayload = (overrides = {}) => ({
    id: new ObjectId().toHexString(),
    fieldKey: 'preferredDates',
    text: redactedText,
    ...mockAuditPayload,
    ...overrides
  })

  it('should validate the payload with the redactText schema', () => {
    expect(redactTextController.options.validate.payload).toBe(redactText)
  })

  describe('handler', () => {
    it('should store the redaction against the field key', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = createPayload()

      const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return { updateOne: mockUpdateOne }
      })

      await redactTextController.handler(
        { db: mockMongo, payload: mockPayload, auth: entraAuth },
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'success' })
      )
      expect(mockMongo.collection).toHaveBeenCalledWith('marine-licences')
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: ObjectId.createFromHexString(mockPayload.id) },
        { $set: { 'redactions.preferredDates': mockRedactions.preferredDates } }
      )
    })

    it('should substitute the indexes into the field path', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = createPayload({
        fieldKey: 'siteDetails.activityDetails.activityDescription',
        siteIndex: 2,
        activityIndex: 1
      })

      const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return { updateOne: mockUpdateOne }
      })

      await redactTextController.handler(
        { db: mockMongo, payload: mockPayload, auth: entraAuth },
        mockHandler
      )

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: ObjectId.createFromHexString(mockPayload.id) },
        {
          $set: {
            'redactions.siteDetails.2.activityDetails.1.activityDescription':
              mockRedactions.preferredDates
          }
        }
      )
    })

    it.each([true, false])(
      'should store a withheld location with audit fields and the flag %s',
      async (withhold) => {
        const { mockMongo, mockHandler } = global
        const mockPayload = createPayload({
          fieldKey: WITHHOLD_LOCATION_FIELD,
          siteIndex: 3,
          text: '',
          withhold
        })

        const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
        vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
          return { updateOne: mockUpdateOne }
        })

        await redactTextController.handler(
          { db: mockMongo, payload: mockPayload, auth: entraAuth },
          mockHandler
        )

        expect(mockUpdateOne).toHaveBeenCalledWith(
          { _id: ObjectId.createFromHexString(mockPayload.id) },
          {
            $set: {
              'redactions.siteDetails.3.withholdLocation': {
                redactedAt,
                redactedBy,
                withhold
              }
            }
          }
        )
      }
    )

    it('should unset the redaction when removing', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = createPayload({
        fieldKey: 'siteDetails.siteName',
        siteIndex: 1,
        text: undefined,
        remove: true
      })

      const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return { updateOne: mockUpdateOne }
      })

      await redactTextController.handler(
        { db: mockMongo, payload: mockPayload, auth: entraAuth },
        mockHandler
      )

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: ObjectId.createFromHexString(mockPayload.id) },
        { $unset: { 'redactions.siteDetails.1.siteName': '' } }
      )
    })

    it('should unset a withheld location when removing', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = createPayload({
        fieldKey: WITHHOLD_LOCATION_FIELD,
        siteIndex: 0,
        text: undefined,
        remove: true
      })

      const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return { updateOne: mockUpdateOne }
      })

      await redactTextController.handler(
        { db: mockMongo, payload: mockPayload, auth: entraAuth },
        mockHandler
      )

      const [, update] = mockUpdateOne.mock.calls[0]
      expect(update).toEqual({
        $unset: { 'redactions.siteDetails.0.withholdLocation': '' }
      })
      expect(update.$set).toBeUndefined()
    })

    it('should store a replacement drawing at the indexed path', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = createPayload({
        fieldKey: 'siteDetails.constructionDrawings.withholdDocument',
        siteIndex: 1,
        drawingIndex: 2,
        text: undefined,
        withhold: true,
        filename: 'redacted.pdf',
        s3Location: mockS3Location
      })

      const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return { updateOne: mockUpdateOne }
      })

      await redactTextController.handler(
        { db: mockMongo, payload: mockPayload, auth: entraAuth },
        mockHandler
      )

      expect(validateConstructionDrawingUpload).toHaveBeenCalledWith(
        mockS3Location
      )
      expect(validateWfdUpload).not.toHaveBeenCalled()
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: ObjectId.createFromHexString(mockPayload.id) },
        {
          $set: {
            'redactions.siteDetails.1.constructionDrawings.2.withholdDocument':
              {
                redactedAt,
                redactedBy,
                withhold: true,
                redactedDocument: {
                  filename: 'redacted.pdf',
                  s3Location: mockS3Location
                }
              }
          }
        }
      )
    })

    it('should validate a replacement WFD document with the WFD rules', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = createPayload({
        fieldKey: 'waterFrameworkDirective.withholdDocument',
        text: undefined,
        filename: 'redacted.docx',
        s3Location: mockS3Location
      })

      const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return { updateOne: mockUpdateOne }
      })

      await redactTextController.handler(
        { db: mockMongo, payload: mockPayload, auth: entraAuth },
        mockHandler
      )

      expect(validateWfdUpload).toHaveBeenCalledWith({
        s3Location: mockS3Location
      })
      expect(validateConstructionDrawingUpload).not.toHaveBeenCalled()
    })

    it('should not write anything if the upload fails validation', async () => {
      const { mockMongo, mockHandler } = global
      const mockUpdateOne = vi.fn()
      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return { updateOne: mockUpdateOne }
      })
      validateWfdUpload.mockRejectedValueOnce(
        Boom.unsupportedMediaType('File must be an ODT or DOCX document')
      )

      await expect(() =>
        redactTextController.handler(
          {
            db: mockMongo,
            payload: createPayload({
              fieldKey: 'waterFrameworkDirective.withholdDocument',
              text: undefined,
              withhold: true,
              filename: 'redacted.zip',
              s3Location: mockS3Location
            }),
            auth: entraAuth
          },
          mockHandler
        )
      ).rejects.toThrow('File must be an ODT or DOCX document')

      expect(mockUpdateOne).not.toHaveBeenCalled()
    })

    it('should not allow a non Entra ID user to save', async () => {
      const { mockMongo, mockHandler } = global
      const mockUpdateOne = vi.fn()
      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return { updateOne: mockUpdateOne }
      })

      await expect(() =>
        redactTextController.handler(
          { db: mockMongo, payload: createPayload(), auth: defraIdAuth },
          mockHandler
        )
      ).rejects.toThrow('Not authorised to redact data')

      expect(mockUpdateOne).not.toHaveBeenCalled()
    })

    it('should return a 404 if the marine licence does not exist', async () => {
      const { mockMongo, mockHandler } = global

      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return {
          updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
        }
      })

      await expect(() =>
        redactTextController.handler(
          { db: mockMongo, payload: createPayload(), auth: entraAuth },
          mockHandler
        )
      ).rejects.toThrow('Marine licence not found')
    })

    it('should return an error message if the database operation fails', async () => {
      const { mockMongo, mockHandler } = global
      const mockError = 'Database failed'

      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return {
          updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
        }
      })

      await expect(() =>
        redactTextController.handler(
          { db: mockMongo, payload: createPayload(), auth: entraAuth },
          mockHandler
        )
      ).rejects.toThrow(`Error redacting data: ${mockError}`)
    })
  })
})
