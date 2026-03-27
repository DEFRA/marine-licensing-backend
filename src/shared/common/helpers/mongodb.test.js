import { vi } from 'vitest'
import { Db, MongoClient } from 'mongodb'
import { LockManager } from 'mongo-locks'
import { up, status } from 'migrate-mongo'
import { addAuditFields, logMigrationStatus, runMigrations } from './mongodb.js'
import { addCreateAuditFields, addUpdateAuditFields } from './mongo-audit.js'

vi.mock('./mongo-audit.js')
vi.mock('migrate-mongo', () => ({
  up: vi.fn().mockResolvedValue([]),
  status: vi.fn().mockResolvedValue([])
}))

const mockUp = vi.mocked(up)
const mockStatus = vi.mocked(status)

describe('#mongoDb migrations', () => {
  const mockDb = {}
  const mockClient = {}
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    fatal: vi.fn(),
    error: vi.fn()
  }
  const lockTtlSeconds = 600

  beforeEach(() => {
    vi.clearAllMocks()
    mockUp.mockResolvedValue([])
    mockStatus.mockResolvedValue([])
  })

  afterAll(() => {
    mockUp.mockReset().mockResolvedValue([])
    mockStatus.mockReset().mockResolvedValue([])
  })

  describe('logMigrationStatus', () => {
    test('should call status with the database', async () => {
      const statusResult = [
        { fileName: '20260326-create-indexes.js', appliedAt: 'PENDING' }
      ]
      mockStatus.mockResolvedValue(statusResult)

      await logMigrationStatus(mockLogger, mockDb)

      expect(mockStatus).toHaveBeenCalledWith(mockDb)
      expect(mockLogger.info).toHaveBeenCalledWith(
        statusResult,
        'Migration status'
      )
    })

    test('should propagate error when status fails', async () => {
      const error = new Error('status failed')
      mockStatus.mockRejectedValue(error)

      await expect(logMigrationStatus(mockLogger, mockDb)).rejects.toThrow(
        'status failed'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        error,
        'Failed to get migration status'
      )
    })
  })

  describe('runMigrations', () => {
    test('should call up with the database and client', async () => {
      const migrated = ['20260326-create-indexes.js']
      mockUp.mockResolvedValue(migrated)

      await runMigrations(mockLogger, mockDb, mockClient, lockTtlSeconds)

      expect(mockUp).toHaveBeenCalledWith(mockDb, mockClient)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          migrated,
          durationSeconds: expect.any(Number)
        }),
        'Migrations applied successfully'
      )
    })

    test('should log no pending migrations when none applied', async () => {
      mockUp.mockResolvedValue([])

      await runMigrations(mockLogger, mockDb, mockClient, lockTtlSeconds)

      expect(mockUp).toHaveBeenCalledWith(mockDb, mockClient)
      expect(mockLogger.info).toHaveBeenCalledWith('No pending migrations')
    })

    test('should warn when migration duration approaches lock TTL', async () => {
      const migrated = ['20260326-create-indexes.js']
      mockUp.mockResolvedValue(migrated)

      // 500s is >= 80% of 600s (warning threshold)
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(500 * 1000)

      await runMigrations(mockLogger, mockDb, mockClient, lockTtlSeconds)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          durationSeconds: expect.any(Number),
          lockTtlSeconds,
          warningThreshold: 480
        }),
        'Migration success: NOTE THAT MIGRATIONS ARE APPROACHING LOCK TTL'
      )
    })

    test('should log fatal when migration duration exceeds lock TTL', async () => {
      const migrated = ['20260326-create-indexes.js']
      mockUp.mockResolvedValue(migrated)

      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(700 * 1000)

      await runMigrations(mockLogger, mockDb, mockClient, lockTtlSeconds)

      expect(mockLogger.fatal).toHaveBeenCalledWith(
        expect.objectContaining({
          durationSeconds: expect.any(Number),
          lockTtlSeconds
        }),
        'THE MIGRATIONS COMPLETED BUT EXCEEDED THE LOCK TTL — OTHER INSTANCES MAY HAVE RUN MIGRATIONS CONCURRENTLY'
      )
    })

    test('should propagate error when up fails', async () => {
      const error = new Error('migration failed')
      mockUp.mockRejectedValue(error)

      await expect(
        runMigrations(mockLogger, mockDb, mockClient, lockTtlSeconds)
      ).rejects.toThrow('migration failed')

      expect(mockLogger.error).toHaveBeenCalledWith(error, 'Migration failed')
    })
  })
})

describe('#mongoDb', () => {
  let server

  // Dynamic import needed due to config being updated by vitest-mongodb
  beforeAll(async () => {
    const { createServer } = await import('../../../server.js')
    server = await createServer()
    await server.initialize()
    // LockManager fires a createIndex during construction that isn't awaited.
    // Wait for it to settle so it doesn't reject during vitest-mongodb teardown.
    await server.db.collection('mongo-locks').createIndex({ id: 1 })
  })

  describe('Set up', () => {
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
    test('Should close Mongo client on server stop', async () => {
      server.mongoClient.close = vi.fn()
      await server.stop({ timeout: 1000 })

      expect(server.mongoClient.close).toHaveBeenCalledWith(true)
    })
  })
})
