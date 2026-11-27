import { vi } from 'vitest'
import { scheduledJobs } from './scheduled-jobs.js'
import { config } from '../../../config.js'
import { collectionExemptions } from '../../common/constants/db-collections.js'
import { londonToday } from '../../common/helpers/london-today.js'
import { updateExemptionStatuses } from '../../../exemptions/api/helpers/update-exemption-statuses.js'
import { warmUpDynamics } from '../../common/helpers/dynamics/warm-up-dynamics.js'

vi.mock('../../common/helpers/london-today.js')
vi.mock('../../../exemptions/api/helpers/update-exemption-statuses.js')
vi.mock('../../common/helpers/dynamics/warm-up-dynamics.js')

describe('scheduledJobs', () => {
  it('every job has a name, a server method name and a run function', () => {
    for (const job of scheduledJobs) {
      expect(typeof job.name).toBe('string')
      expect(typeof job.methodName).toBe('string')
      expect(typeof job.run).toBe('function')
    }
  })

  it('job names are unique, because they form the coordination key', () => {
    const names = scheduledJobs.map((job) => job.name)

    expect(new Set(names).size).toBe(names.length)
  })

  it('every job has a matching entry in scheduler config', () => {
    const jobs = config.get('scheduler.jobs')

    for (const job of scheduledJobs) {
      expect(jobs[job.name]).toBeDefined()
    }
  })

  describe('heartbeat', () => {
    const heartbeat = () =>
      scheduledJobs.find((job) => job.name === 'heartbeat')

    it('is registered', () => {
      expect(heartbeat()).toBeDefined()
      expect(heartbeat().methodName).toBe('runSchedulerHeartbeat')
    })

    it('reports a breakdown across every status for the log line', async () => {
      const toArray = vi.fn().mockResolvedValue([
        { _id: 'ACTIVE', count: 3000 },
        { _id: 'DRAFT', count: 500 },
        { _id: 'EXPIRED', count: 3000 },
        { _id: 'SCHEDULED', count: 3000 },
        { _id: 'WITHDRAWN', count: 500 }
      ])
      const aggregate = vi.fn().mockReturnValue({ toArray })
      const server = {
        db: { collection: vi.fn().mockReturnValue({ aggregate }) }
      }

      const result = await heartbeat().run(server)

      expect(server.db.collection).toHaveBeenCalledWith(collectionExemptions)
      expect(aggregate).toHaveBeenCalledWith([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
      expect(result).toEqual({
        summary:
          '10,000 exemptions — 3,000 scheduled; 3,000 active; 3,000 expired; 500 draft; 500 withdrawn'
      })
    })

    it('reports a zero rather than omitting a status with no documents', async () => {
      const toArray = vi.fn().mockResolvedValue([{ _id: 'DRAFT', count: 2 }])
      const server = {
        db: {
          collection: vi.fn().mockReturnValue({
            aggregate: vi.fn().mockReturnValue({ toArray })
          })
        }
      }

      const result = await heartbeat().run(server)

      expect(result.summary).toBe(
        '2 exemptions — 0 scheduled; 0 active; 0 expired; 2 draft; 0 withdrawn'
      )
    })
  })

  describe('exemption-status', () => {
    const exemptionStatus = () =>
      scheduledJobs.find((job) => job.name === 'exemption-status')

    it('is registered', () => {
      expect(exemptionStatus()).toBeDefined()
      expect(exemptionStatus().methodName).toBe('runSchedulerExemptionStatus')
    })

    it('derives today from the London clock and delegates to the status updater', async () => {
      const today = new Date('2026-08-25T00:00:00.000Z')
      vi.mocked(londonToday).mockReturnValue(today)
      vi.mocked(updateExemptionStatuses).mockResolvedValue({
        summary:
          '0 exemptions updated — 0 scheduled; 0 active; 0 expired; 0 unchanged'
      })
      const server = { db: { collection: vi.fn() }, logger: { warn: vi.fn() } }

      const result = await exemptionStatus().run(server)

      expect(updateExemptionStatuses).toHaveBeenCalledWith(server, today)
      expect(result.summary).toContain('exemptions updated')
    })
  })

  describe('dynamics-warmup', () => {
    const dynamicsWarmup = () =>
      scheduledJobs.find((job) => job.name === 'dynamics-warmup')

    it('is registered', () => {
      expect(dynamicsWarmup()).toBeDefined()
      expect(dynamicsWarmup().methodName).toBe('runSchedulerDynamicsWarmup')
    })

    it('passes the configured path to the warm-up and returns its result', async () => {
      const key = 'scheduler.jobs.dynamics-warmup.path'
      const originalPath = config.get(key)
      config.set(key, '/test-warmup-path')
      vi.mocked(warmUpDynamics).mockResolvedValue({ summary: 'warm' })

      try {
        const result = await dynamicsWarmup().run({})

        expect(result).toEqual({ summary: 'warm' })
        expect(warmUpDynamics).toHaveBeenCalledWith({
          path: '/test-warmup-path'
        })
      } finally {
        config.set(key, originalPath)
      }
    })
  })
})
