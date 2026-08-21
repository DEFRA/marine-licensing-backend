import { convictValidateCronExpression } from './validate-scheduler.js'

describe('convictValidateCronExpression', () => {
  it('has the expected format name', () => {
    expect(convictValidateCronExpression.name).toBe('cron-expression')
  })

  it.each([
    ['5 0 * * *', 'daily just after midnight'],
    ['0 * * * *', 'hourly'],
    ['*/15 * * * *', 'every fifteen minutes'],
    ['0 3 * * 1', 'weekly'],
    ['30 23 * * *', 'late evening']
  ])('accepts %s (%s)', (expression) => {
    expect(() =>
      convictValidateCronExpression.validate(expression)
    ).not.toThrow()
  })

  // The scheduler does not police cadence, so the British Summer Time-ambiguous
  // hour is permitted with a documented caveat rather than rejected.
  it('accepts a schedule naming 01:00, which is a documented caveat not an error', () => {
    expect(() =>
      convictValidateCronExpression.validate('0 1 * * *')
    ).not.toThrow()
  })

  it.each([
    ['5 0 * *', 'too few fields'],
    ['not a cron', 'not an expression'],
    ['60 0 * * *', 'minute out of range'],
    ['5 24 * * *', 'hour out of range']
  ])('rejects %s (%s)', (expression) => {
    expect(() => convictValidateCronExpression.validate(expression)).toThrow()
  })

  it('rejects non-string values', () => {
    expect(() => convictValidateCronExpression.validate(500)).toThrow(
      /must be a cron expression string/
    )
  })
})
