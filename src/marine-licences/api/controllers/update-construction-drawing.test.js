import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updateConstructionDrawingController } from './update-construction-drawing.js'
import { validateConstructionDrawingUpload } from '../helpers/validateConstructionDrawingUpload.js'
import Boom from '@hapi/boom'

vi.mock('../helpers/validateConstructionDrawingUpload.js')

describe('PATCH /marine-licence/update-construction-drawing', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const s3Location = {
    s3Bucket: 'mmo-uploads',
    s3Key: 'test-file-key',
    checksumSha256: 'test-checksum'
  }

  const existingUpdatedAt = new Date('2024-12-01T10:00:00Z')

  const buildPayload = (overrides = {}) => ({
    id: new ObjectId().toHexString(),
    siteIndex: 0,
    drawingIndex: 0,
    filename: 'drawing.pdf',
    s3Location,
    ...mockAuditPayload,
    ...overrides
  })

  const mockDbFor = (marineLicence, updateOneResult = { matchedCount: 1 }) => {
    const mockFindOne = vi.fn().mockResolvedValueOnce(marineLicence)
    const mockUpdateOne = vi.fn().mockResolvedValueOnce(updateOneResult)
    const mockDb = {
      collection: vi.fn().mockReturnValue({
        findOne: mockFindOne,
        updateOne: mockUpdateOne
      })
    }
    return { mockDb, mockFindOne, mockUpdateOne }
  }

  describe('handler', () => {
    it('sets the drawing at index 0 even when no constructionDrawings array exists yet', async () => {
      const { mockHandler } = global
      const mockPayload = buildPayload()
      const { mockDb, mockUpdateOne } = mockDbFor({
        _id: mockPayload.id,
        updatedAt: existingUpdatedAt,
        siteDetails: [{}]
      })

      await updateConstructionDrawingController.handler(
        { db: mockDb, payload: mockPayload },
        mockHandler
      )

      expect(validateConstructionDrawingUpload).toHaveBeenCalledWith(s3Location)
      expect(mockHandler.response).toHaveBeenCalledWith({ message: 'success' })
      expect(mockUpdateOne).toHaveBeenCalledWith(
        {
          _id: ObjectId.createFromHexString(mockPayload.id),
          'siteDetails.0': { $exists: true },
          updatedAt: existingUpdatedAt
        },
        {
          $set: {
            'siteDetails.0.constructionDrawings': [
              {
                filename: 'drawing.pdf',
                s3Location
              }
            ],
            siteDetailsConfirmed: false,
            ...mockAuditPayload
          }
        }
      )
    })

    it('sets an existing drawing index for a site with multiple drawings', async () => {
      const { mockHandler } = global
      const mockPayload = buildPayload({ drawingIndex: 1 })
      const { mockDb, mockUpdateOne } = mockDbFor({
        _id: mockPayload.id,
        updatedAt: existingUpdatedAt,
        siteDetails: [{ constructionDrawings: [{ filename: 'a.pdf' }, {}] }]
      })

      await updateConstructionDrawingController.handler(
        { db: mockDb, payload: mockPayload },
        mockHandler
      )

      expect(mockUpdateOne).toHaveBeenCalledWith(
        {
          _id: ObjectId.createFromHexString(mockPayload.id),
          'siteDetails.0': { $exists: true },
          updatedAt: existingUpdatedAt
        },
        expect.objectContaining({
          $set: expect.objectContaining({
            'siteDetails.0.constructionDrawings.1': {
              filename: 'drawing.pdf',
              s3Location
            }
          })
        })
      )
      expect(mockHandler.response).toHaveBeenCalledWith({ message: 'success' })
    })

    it('throws 409 when the document was modified by another user between validation and write', async () => {
      const { mockHandler } = global
      const mockPayload = buildPayload()
      const { mockDb } = mockDbFor(
        {
          _id: mockPayload.id,
          updatedAt: existingUpdatedAt,
          siteDetails: [{}]
        },
        { matchedCount: 0 }
      )

      vi.spyOn(Boom, 'conflict')

      await expect(() =>
        updateConstructionDrawingController.handler(
          { db: mockDb, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow('was modified by another user')
    })

    it('throws 404 when the marine licence or site index does not exist', async () => {
      const { mockHandler } = global
      const mockPayload = buildPayload({ siteIndex: 99 })
      const { mockDb } = mockDbFor({ _id: mockPayload.id, siteDetails: [{}] })

      vi.spyOn(Boom, 'notFound')

      await expect(() =>
        updateConstructionDrawingController.handler(
          { db: mockDb, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow('Marine licence not found or invalid site index')
    })

    it('throws 404 when the drawing index is beyond the existing drawings and is not 0', async () => {
      const { mockHandler } = global
      const mockPayload = buildPayload({ drawingIndex: 5 })
      const { mockDb } = mockDbFor({
        _id: mockPayload.id,
        siteDetails: [{ constructionDrawings: [{}] }]
      })

      await expect(() =>
        updateConstructionDrawingController.handler(
          { db: mockDb, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow('Marine licence not found or invalid site index')
    })

    it('propagates errors thrown by upload validation', async () => {
      const { mockHandler } = global
      const mockPayload = buildPayload()

      vi.mocked(validateConstructionDrawingUpload).mockRejectedValueOnce(
        Boom.unsupportedMediaType('File must be a PDF or an image')
      )

      const { mockDb } = mockDbFor({ _id: mockPayload.id, siteDetails: [{}] })

      await expect(() =>
        updateConstructionDrawingController.handler(
          { db: mockDb, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow('File must be a PDF or an image')
    })

    it('throws a 500 when the database operation fails', async () => {
      const { mockHandler } = global
      const mockPayload = buildPayload()
      const mockError = 'Database exploded'

      vi.mocked(validateConstructionDrawingUpload).mockResolvedValueOnce()
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          findOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
        })
      }

      await expect(() =>
        updateConstructionDrawingController.handler(
          { db: mockDb, payload: mockPayload },
          mockHandler
        )
      ).rejects.toThrow(`Error updating construction drawing: ${mockError}`)
    })
  })
})
