import { vi } from 'vitest'
import { Db, MongoClient } from 'mongodb'
import { LockManager } from 'mongo-locks'
import { addAuditFields } from './mongodb.js'
import { addCreateAuditFields, addUpdateAuditFields } from './mongo-audit.js'

vi.mock('./mongo-audit.js')

describe('#mongoDb', () => {
  let server

  describe('Set up', () => {
    beforeAll(async () => {
      // Dynamic import needed due to config being updated by vitest-mongodb
      const { createServer } = await import('../../server.js')
      server = await createServer()
      await server.initialize()
    })

    test('Server should have expected MongoDb decorators', () => {
      expect(server.db).toBeInstanceOf(Db)
      expect(server.mongoClient).toBeInstanceOf(MongoClient)
      expect(server.locker).toBeInstanceOf(LockManager)
    })

    test('MongoDb should have expected database name', () => {
      expect(server.db.databaseName).toBe('marine-licensing-backend')
    })

    test('MongoDb should have expected namespace', () => {
      expect(server.db.namespace).toBe('marine-licensing-backend')
    })
  })

  describe('addAuditFields extension', () => {
    const mockedAddCreateAuditFields = vi.mocked(addCreateAuditFields)
    const mockedAddUpdateAuditFields = vi.mocked(addUpdateAuditFields)

    test('should add create audit fields for POST requests with auth and payload', async () => {
      const mockPayload = { name: 'Test Project' }

      const mockAuth = { credentials: { contactId: 'user123' } }

      const mockAuditedPayload = {
        ...mockPayload,
        createdAt: new Date(),
        createdBy: 'user123',
        updatedAt: new Date(),
        updatedBy: 'user123'
      }

      mockedAddCreateAuditFields.mockReturnValue(mockAuditedPayload)

      const request = {
        method: 'post',
        payload: mockPayload,
        auth: mockAuth
      }
      const h = {
        continue: 'continue'
      }

      const result = await addAuditFields(request, h)

      expect(mockedAddCreateAuditFields).toHaveBeenCalledWith(
        mockAuth,
        mockPayload
      )
      expect(request.payload).toEqual(mockAuditedPayload)
      expect(result).toBe('continue')
    })

    test('should add update audit fields for PATCH requests with auth and payload', async () => {
      const mockPayload = { name: 'Patched Project' }
      const mockAuth = { credentials: { contactId: 'user789' } }
      const mockAuditedPayload = {
        ...mockPayload,
        updatedAt: new Date(),
        updatedBy: 'user789'
      }

      mockedAddUpdateAuditFields.mockReturnValue(mockAuditedPayload)

      const request = {
        method: 'PATCH',
        payload: mockPayload,
        auth: mockAuth
      }
      const h = {
        continue: 'continue'
      }

      const result = await addAuditFields(request, h)

      expect(mockedAddUpdateAuditFields).toHaveBeenCalledWith(
        mockAuth,
        mockPayload
      )
      expect(request.payload).toEqual(mockAuditedPayload)
      expect(result).toBe('continue')
    })

    test('should not add audit fields when no auth credentials exist', async () => {
      const request = {
        method: 'POST',
        payload: { name: 'Test Project' },
        auth: null
      }

      const h = {
        continue: 'continue'
      }

      const result = await addAuditFields(request, h)

      expect(mockedAddCreateAuditFields).not.toHaveBeenCalled()
      expect(mockedAddUpdateAuditFields).not.toHaveBeenCalled()
      expect(result).toBe('continue')
    })

    test('should not add update audit fields for GET requests', async () => {
      const request = {
        method: 'GET',
        auth: { credentials: { contactId: 'user123' } }
      }
      const h = {
        continue: 'continue'
      }

      const result = await addAuditFields(request, h)

      expect(mockedAddCreateAuditFields).not.toHaveBeenCalled()
      expect(mockedAddUpdateAuditFields).not.toHaveBeenCalled()
      expect(result).toBe('continue')
    })

    test('should not add update audit fields for DELETE requests', async () => {
      const request = {
        method: 'DELETE',
        auth: { credentials: { contactId: 'user123' } }
      }
      const h = {
        continue: 'continue'
      }

      const result = await addAuditFields(request, h)

      expect(mockedAddCreateAuditFields).not.toHaveBeenCalled()
      expect(mockedAddUpdateAuditFields).not.toHaveBeenCalled()
      expect(result).toBe('continue')
    })
  })

  describe('Shut down', () => {
    beforeAll(async () => {
      // Dynamic import needed due to config being updated by vitest-mongodb
      const { createServer } = await import('../../server.js')
      server = await createServer()
      await server.initialize()
    })

    test('Should close Mongo client on server stop', async () => {
      const closeSpy = vi.spyOn(server.mongoClient, 'close')
      await server?.stop({ timeout: 1000 })

      expect(closeSpy).toHaveBeenCalledWith(true)
    })
  })
})
