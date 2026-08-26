import { vi } from 'vitest'
import { scheduledJobs } from './scheduled-jobs.js'
import { config } from '../../../config.js'
import { EXEMPTION_STATUS } from '../../../exemptions/constants/exemption.js'
import { collectionExemptions } from '../../common/constants/db-collections.js'
import { londonToday } from '../../common/helpers/london-today.js'
import { updateExemptionStatuses } from '../../../exemptions/api/helpers/update-exemption-statuses.js'

vi.mock('../../common/helpers/london-today.js')
vi.mock('../../../exemptions/api/helpers/update-exemption-statuses.js')

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

    it('counts active exemptions and returns a summary for the log line', async () => {
      const countDocuments = vi.fn().mockResolvedValue(12)
      const server = {
        db: { collection: vi.fn().mockReturnValue({ countDocuments }) }
      }

      const result = await heartbeat().run(server)

      expect(server.db.collection).toHaveBeenCalledWith(collectionExemptions)
      expect(countDocuments).toHaveBeenCalledWith({
        status: EXEMPTION_STATUS.ACTIVE
      })
      expect(result).toEqual({ summary: '12 active exemptions' })
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

      expect(updateExemptionStatuses).toHaveBeenCalledWith(
        server.db,
        today,
        server.logger
      )
      expect(result.summary).toContain('exemptions updated')
    })
  })
})
