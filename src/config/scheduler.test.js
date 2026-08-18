import { config } from '../config.js'

describe('scheduler config', () => {
  it('exposes defaults for the scheduler and the heartbeat job', () => {
    const scheduler = config.get('scheduler')

    expect(scheduler.isEnabled).toBe(true)
    expect(scheduler.timezone).toBe('Europe/London')
    expect(scheduler.jobs.heartbeat.isEnabled).toBe(true)
    expect(scheduler.jobs.heartbeat.schedule).toBe('5 0 * * *')
  })
})
