import { config } from '../config.js'

describe('scheduler config', () => {
  it('exposes defaults for the scheduler and the heartbeat job', () => {
    const scheduler = config.get('scheduler')

    expect(scheduler.isEnabled).toBe(true)
    expect(scheduler.jobs.heartbeat.isEnabled).toBe(true)
    expect(scheduler.jobs.heartbeat.schedule).toBe('15 0 * * *')
  })

  // The timezone is fixed in code, so there is deliberately nothing to
  // configure. This fails if the key is ever reintroduced without the
  // iana-timezone format that used to stop BST resolving to Asia/Dhaka.
  it('does not expose a configurable timezone', () => {
    expect(() => config.get('scheduler.timezone')).toThrow(
      /cannot find configuration param/
    )
  })
})
