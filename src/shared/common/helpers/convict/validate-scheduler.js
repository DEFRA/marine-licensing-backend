import { parse } from 'node-cron'

export const convictValidateCronExpression = {
  name: 'cron-expression',
  validate: function validateCronExpression(value) {
    if (typeof value !== 'string') {
      throw new TypeError(
        `Schedule must be a cron expression string, received ${typeof value}`
      )
    }

    // Syntax only. Throws with node-cron's own field-specific message naming
    // the offending field and value, which is what makes a malformed schedule
    // fail at config.validate() time. Cadence is deliberately not policed — see
    // the British Summer Time note in src/config/scheduler.js.
    parse(value)
  }
}
