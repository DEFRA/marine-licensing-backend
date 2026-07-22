import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { updateInvoicingController } from './update-invoicing.js'
import {
  mockUkInvoicingAddress,
  mockInvoiceContactDetails
} from '../../../../tests/test.fixture.js'

describe('PATCH /marine-licence/invoicing', () => {
  const mockAuditPayload = {
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const mockAgentAuth = {
    credentials: {
      contactId: 'test-contact-id'
    },
    artifacts: {
      decoded: {
        currentRelationshipId: '81d48d6c-6e94-f011-b4cc-000d3ac28f39',
        relationships: [
          '81d48d6c-6e94-f011-b4cc-000d3ac28f39:27d48d6c-6e94-f011-b4cc-000d3ac28f39:CDP Child Org 1:0:Employee:0'
        ]
      }
    }
  }

  test('should update marine licence with invoicing', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      invoiceAddressType: 'uk',
      invoiceAddress: mockUkInvoicingAddress,
      invoiceContactDetails: mockInvoiceContactDetails,
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
            invoiceAddressType: mockPayload.invoiceAddressType,
            invoiceAddress: mockPayload.invoiceAddress,
            invoiceContactDetails: mockPayload.invoiceContactDetails
          },
          ...mockAuditPayload
        }
      }
    )

    expect(mockUpdateOne.mock.calls[0][1].$set.invoicing).not.toHaveProperty(
      'purchaseOrderDetails'
    )
  })

  test('should require and persist purchaseOrderDetails for a non-citizen', async () => {
    const { mockMongo, mockHandler } = global
    const mockPurchaseOrderDetails = { requiresPurchaseOrder: 'no' }
    const mockPayload = {
      id: new ObjectId().toHexString(),
      invoiceAddressType: 'uk',
      invoiceAddress: mockUkInvoicingAddress,
      invoiceContactDetails: mockInvoiceContactDetails,
      ...mockAuditPayload
    }

    const mockUpdateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 1 })
    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: mockUpdateOne
      }
    })

    await expect(() =>
      updateInvoicingController.handler(
        {
          db: mockMongo,
          payload: mockPayload,
          auth: mockAgentAuth
        },
        mockHandler
      )
    ).rejects.toThrow('Purchase order details are required')

    expect(mockUpdateOne).not.toHaveBeenCalled()

    await updateInvoicingController.handler(
      {
        db: mockMongo,
        payload: {
          ...mockPayload,
          purchaseOrderDetails: mockPurchaseOrderDetails
        },
        auth: mockAgentAuth
      },
      mockHandler
    )

    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(mockPayload.id) },
      {
        $set: {
          invoicing: {
            invoiceAddressType: mockPayload.invoiceAddressType,
            invoiceAddress: mockPayload.invoiceAddress,
            invoiceContactDetails: mockPayload.invoiceContactDetails,
            purchaseOrderDetails: mockPurchaseOrderDetails
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
      invoiceAddress: mockUkInvoicingAddress,
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

  test('should return a 404 if id is not correct', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      id: new ObjectId().toHexString(),
      invoiceAddressType: 'uk',
      invoiceAddress: mockUkInvoicingAddress,
      ...mockAuditPayload
    }

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        updateOne: vi.fn().mockResolvedValueOnce({ matchedCount: 0 })
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
    ).rejects.toThrow('Marine licence not found')
  })
})
