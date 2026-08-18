import { parse } from 'node-cron'

export const convictValidateCronExpression = {
  name: 'cron-expression',
  validate: function validateCronExpression(value) {
    if (typeof value !== 'string') {
      throw new Error(
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

export const convictValidateTimezone = {
  name: 'iana-timezone',
  validate: function validateTimezone(value) {
    let resolved

    try {
      resolved = new Intl.DateTimeFormat('en-GB', {
        timeZone: value
      }).resolvedOptions().timeZone
    } catch {
      throw new Error(`"${value}" is not a recognised IANA timezone`)
    }

    // Constructing successfully is not enough. Intl accepts legacy abbreviations
    // and silently maps them elsewhere — BST to Asia/Dhaka, EST to
    // America/Panama, GMT to UTC — so a job would run in a timezone nobody
    // configured, which is a silent misconfiguration rather than a startup
    // failure. Requiring the value to be its own canonical name rejects those
    // while still accepting Europe/London, UTC and any case variation.
    if (String(resolved).toLowerCase() !== String(value).toLowerCase()) {
      throw new Error(
        `"${value}" is not a recognised IANA timezone (it resolves to ${resolved})`
      )
    }
  }
}
