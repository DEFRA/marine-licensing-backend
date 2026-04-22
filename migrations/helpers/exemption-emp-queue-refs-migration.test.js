import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { collectionEmpQueue } from '../../src/shared/common/constants/db-collections.js'
import {
  DEFAULT_REFS_CONFIG_PATH,
  getReferenceListFromConfig,
  parseApplicationReferenceList,
  upClearExemptionEmpQueue
} from './exemption-emp-queue-refs-migration.js'

describe('exemption-emp-queue-refs-migration', () => {
  describe('parseApplicationReferenceList', () => {
    test('returns empty array for null/empty', () => {
      expect(parseApplicationReferenceList('')).toEqual([])
      expect(parseApplicationReferenceList('   ')).toEqual([])
      expect(parseApplicationReferenceList(undefined)).toEqual([])
    })

    test('splits and trims comma-separated values', () => {
      expect(
        parseApplicationReferenceList('EXE/2026/10034, EXE/2026/10035')
      ).toEqual(['EXE/2026/10034', 'EXE/2026/10035'])
    })
  })

  describe('getReferenceListFromConfig', () => {
    test('resolves the default path when the override env is not set', () => {
      const errorLog = vi.fn()

      const refs = getReferenceListFromConfig(
        (p) => {
          expect(p).toBe(DEFAULT_REFS_CONFIG_PATH)
          return 'A, B'
        },
        {},
        errorLog
      )

      expect(refs).toEqual(['A', 'B'])
      expect(errorLog).not.toHaveBeenCalled()
    })

    test('uses MIGRATION_EMP_QUEUE_REFS_CONFIG_PATH when set', () => {
      const errorLog = vi.fn()
      const env = { MIGRATION_EMP_QUEUE_REFS_CONFIG_PATH: 'custom.refs' }

      const refs = getReferenceListFromConfig(
        (p) => {
          expect(p).toBe('custom.refs')
          return 'EXE/1'
        },
        env,
        errorLog
      )

      expect(refs).toEqual(['EXE/1'])
    })

    test('invokes errorLog and returns [] when the config value is not a string', () => {
      const errorLog = vi.fn()

      const refs = getReferenceListFromConfig(() => 42, {}, errorLog)

      expect(refs).toEqual([])
      expect(errorLog).toHaveBeenCalledWith(
        expect.stringMatching(/value at config path .* is not a string/)
      )
    })

    test('invokes errorLog and returns [] when config get throws', () => {
      const errorLog = vi.fn()
      const err = new Error('not found')

      const refs = getReferenceListFromConfig(
        () => {
          throw err
        },
        {},
        errorLog
      )

      expect(refs).toEqual([])
      expect(errorLog).toHaveBeenCalledTimes(1)
      const [errLine] = errorLog.mock.calls[0]
      expect(errLine).toContain('failed to read config')
      expect(errLine).toContain(err.message)
    })
  })

  describe('upClearExemptionEmpQueue', () => {
    const log = { error: vi.fn(), info: vi.fn() }
    const configGet = vi.fn()

    beforeEach(() => {
      log.error.mockClear()
      log.info.mockClear()
      configGet.mockReset()
    })

    test('is a no-op and does not call deleteMany when the list is empty', async () => {
      configGet.mockReturnValue('')

      const deleteMany = vi.fn()
      const db = { collection: () => ({ deleteMany }) }

      await upClearExemptionEmpQueue(db, {
        configGet,
        log,
        env: {}
      })

      expect(deleteMany).not.toHaveBeenCalled()
    })

    test('calls deleteMany for collection exemption-emp-queue with parsed $in', async () => {
      configGet.mockReturnValue('EXE/2026/10034, EXE/2026/10035')
      const deleteMany = vi.fn().mockResolvedValue({ deletedCount: 2 })
      const collection = vi.fn().mockReturnValue({ deleteMany })
      const db = { collection }

      await upClearExemptionEmpQueue(db, { configGet, log, env: {} })

      expect(collection).toHaveBeenCalledWith(collectionEmpQueue)
      expect(deleteMany).toHaveBeenCalledWith({
        applicationReferenceNumber: {
          $in: ['EXE/2026/10034', 'EXE/2026/10035']
        }
      })
    })

    test('uses log.info for removed count', async () => {
      configGet.mockReturnValue('A')
      const deleteMany = vi.fn().mockResolvedValue({ deletedCount: 0 })
      const db = { collection: () => ({ deleteMany }) }

      await upClearExemptionEmpQueue(db, { configGet, log, env: {} })

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('no documents removed')
      )
    })
  })
})

describe('MIGRATION_EMP_QUEUE_REFS_CONFIG_PATH in process.env', () => {
  const errorLog = vi.fn()

  afterEach(() => {
    vi.unstubAllEnvs()
    errorLog.mockClear()
  })

  test('getReferenceListFromConfig picks up stubbed env for path override', () => {
    vi.stubEnv('MIGRATION_EMP_QUEUE_REFS_CONFIG_PATH', 'other.path')

    const refs = getReferenceListFromConfig(
      (p) => {
        expect(p).toBe('other.path')
        return 'R1,R2'
      },
      process.env,
      errorLog
    )

    expect(refs).toEqual(['R1', 'R2'])
  })
})
