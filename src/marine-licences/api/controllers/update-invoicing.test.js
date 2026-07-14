import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updateInvoicingController } from './update-invoicing.js'

describe('PATCH /marine-licence/invoicing', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  test('should update marine licence with invoicing', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      invoiceAddressType: 'uk',
      ...mockAuditPayload
    }

    const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: mockUpdateOne
      }
    })

    await updateInvoicingController.handler(
      {
        db: mockMongo,
        payload: mockPayload
      },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'success' })
    )

    expect(mockMongo.collection).toHaveBeenCalledWith('marine-licences')
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(mockPayload.id) },
      {
        $set: {
          invoicing: {
            invoiceAddressType: mockPayload.invoiceAddressType
          },
          ...mockAuditPayload
        }
      }
    )
  })

  test('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      invoiceAddressType: 'uk',
      ...mockAuditPayload
    }

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      updateInvoicingController.handler(
        {
          db: mockMongo,
          payload: mockPayload
        },
        mockHandler
      )
    ).rejects.toThrow(`Error updating invoicing: ${mockError}`)
  })


})
