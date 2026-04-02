import { vi } from 'vitest'
import { Db, MongoClient } from 'mongodb'
import { LockManager } from 'mongo-locks'
import { up, status } from 'migrate-mongo'
import {
  addAuditFields,
  logMigrationStatus,
  runMigrations,
  runMigrationsWithLock
} from './mongodb.js'
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
        'Migration status: 20260326-create-indexes.js - PENDING'
      )
    })

    test('should propagate error when status fails', async () => {
      const error = new Error('status failed')
      mockStatus.mockRejectedValue(error)

      await expect(logMigrationStatus(mockLogger, mockDb)).rejects.toThrow(
        'status failed'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: 'status failed' })
        }),
        'Failed to get migration status'
      )
    })
  })

  describe('runMigrations', () => {
    test('should call up with the database and client', async () => {
      const migrated = ['20260326-create-indexes.js']
      mockUp.mockResolvedValue(migrated)

      await runMigrations(mockLogger, mockDb, mockClient)

      expect(mockUp).toHaveBeenCalledWith(mockDb, mockClient)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Migration applied: 20260326-create-indexes.js'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('All 1 migrations applied in')
      )
    })

    test('should log no pending migrations when none applied', async () => {
      mockUp.mockResolvedValue([])

      await runMigrations(mockLogger, mockDb, mockClient)

      expect(mockUp).toHaveBeenCalledWith(mockDb, mockClient)
      expect(mockLogger.info).toHaveBeenCalledWith('No pending migrations')
    })

    test('should propagate error when up fails', async () => {
      const error = new Error('migration failed')
      mockUp.mockRejectedValue(error)

      await expect(
        runMigrations(mockLogger, mockDb, mockClient)
      ).rejects.toThrow('migration failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: 'migration failed' })
        }),
        'Migration failed'
      )
    })
  })

  describe('runMigrationsWithLock', () => {
    const createMockLocker = (lockOnAttempt = 1) => {
      let attempt = 0
      const mockLock = { free: vi.fn().mockResolvedValue(true) }
      return {
        locker: {
          lock: vi.fn().mockImplementation(() => {
            attempt++
            return Promise.resolve(attempt >= lockOnAttempt ? mockLock : null)
          })
        },
        mockLock
      }
    }

    test('should acquire lock, run migrations, then release lock', async () => {
      const { locker, mockLock } = createMockLocker()
      mockUp.mockResolvedValue(['migration.js'])

      await runMigrationsWithLock(mockLogger, mockDb, mockClient, locker)

      expect(locker.lock).toHaveBeenCalledWith('migration-lock')
      expect(mockUp).toHaveBeenCalledWith(mockDb, mockClient)
      expect(mockLock.free).toHaveBeenCalled()
    })

    test('should retry when lock is not available', async () => {
      vi.useFakeTimers()

      const { locker, mockLock } = createMockLocker(3)
      mockUp.mockResolvedValue([])

      const promise = runMigrationsWithLock(
        mockLogger,
        mockDb,
        mockClient,
        locker
      )

      await vi.advanceTimersByTimeAsync(5_000)
      await vi.advanceTimersByTimeAsync(5_000)
      await promise

      expect(locker.lock).toHaveBeenCalledTimes(3)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Another instance is running migrations, waiting for lock...'
      )
      expect(mockLock.free).toHaveBeenCalled()

      vi.useRealTimers()
    })

    test('should release lock even when migration fails', async () => {
      const { locker, mockLock } = createMockLocker()
      mockUp.mockRejectedValue(new Error('migration failed'))

      await expect(
        runMigrationsWithLock(mockLogger, mockDb, mockClient, locker)
      ).rejects.toThrow('migration failed')

      expect(mockLock.free).toHaveBeenCalled()
    })
  })
})

describe('#mongoDb', () => {
  let server

  // Dynamic import needed due to config being updated by vitest-mongodb
  // Extended timeout: server startup now includes migration status checks and lock acquisition
  beforeAll(async () => {
    const { createServer } = await import('../../../server.js')
    server = await createServer()
    await server.initialize()
    // LockManager fires a createIndex during construction that isn't awaited.
    // Wait for it to settle so it doesn't reject during vitest-mongodb teardown.
    await server.db
      .collection('mongo-locks')
      .createIndex({ action: 1 }, { unique: true })
  }, 30_000)

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
