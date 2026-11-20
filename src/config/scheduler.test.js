import { config } from '../config.js'

describe('scheduler config', () => {
  it('exposes defaults for the scheduler and the heartbeat job', () => {
    const scheduler = config.get('scheduler')

    expect(scheduler.isEnabled).toBe(true)
    expect(scheduler.jobs.heartbeat.isEnabled).toBe(true)
    expect(scheduler.jobs.heartbeat.schedule).toBe('15 0 * * *')
  })

  it('exposes defaults for the Dynamics warm-up job', () => {
    expect(config.get('scheduler.jobs.dynamics-warmup')).toEqual({
      isEnabled: true,
      schedule: '0 * * * *',
      path: '/contacts?$select=fullname&$top=1'
    })
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
