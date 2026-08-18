// Cron expression reference, for editing these schedules by hand.
//
//   ┌──────────── minute        0-59
//   │ ┌────────── hour          0-23
//   │ │ ┌──────── day of month  1-31
//   │ │ │ ┌────── month         1-12, or JAN-DEC
//   │ │ │ │ ┌──── day of week   0-7, or SUN-SAT (0 and 7 both mean Sunday)
//   │ │ │ │ │
//   * * * * *
//
// Within a field: `*` is every value, `*/n` every nth, `a,b` a list, `a-b` a
// range. node-cron also accepts a leading seconds field (six in all) and the
// nicknames `@hourly`, `@daily`, `@weekly`, `@monthly`, `@yearly` — nothing here
// needs sub-minute scheduling.
//
//   '5 0 * * *'    00:05 every day, the heartbeat default below
//   '0 */4 * * *'  every four hours, on the hour
//   '30 6 * * 1'   06:30 every Monday
//   '0 0 1 * *'    midnight on the 1st of each month
//
// British Summer Time caveat, deliberately not enforced by validation.
//
// Schedules are interpreted in `timezone` below (Europe/London by default), and
// two days a year that timezone has no 01:00-01:59 or has it twice:
//
//   - Last Sunday in March, the clock goes 00:59:59 GMT -> 02:00:00 BST, so a
//     schedule naming that hour does not fire at all that day.
//   - Last Sunday in October, 01:00-01:59 occurs twice, so it may fire twice.
//
// Any cadence is allowed regardless. Jobs are required to be idempotent and
// backward-looking (see the scheduled job contract), so a single missed fire is
// normally picked up by the next run. If that is not acceptable for a particular
// job, give it an hour outside 01:00-01:59 — 00:05 is a safe default.
export const schedulerSchema = {
  isEnabled: {
    doc: 'Master switch for scheduling. When false no job is scheduled, but every job body remains invokable via its server method.',
    format: Boolean,
    default: true,
    env: 'SCHEDULER_ENABLED'
  },
  timezone: {
    doc: 'Canonical IANA timezone every job schedule is interpreted in. Europe/London keeps the run tied to the UK calendar date rather than UTC. Abbreviations are rejected — BST is not Europe/London, it is Asia/Dhaka.',
    format: 'iana-timezone',
    default: 'Europe/London',
    env: 'SCHEDULER_TIMEZONE'
  },
  jobs: {
    heartbeat: {
      isEnabled: {
        doc: 'Enable the example heartbeat job',
        format: Boolean,
        default: true,
        env: 'SCHEDULER_HEARTBEAT_ENABLED'
      },
      schedule: {
        doc: 'Cron schedule for the heartbeat job, interpreted in scheduler.timezone. See the cron format reference and the British Summer Time note at the top of this file.',
        format: 'cron-expression',
        default: '5 0 * * *',
        env: 'SCHEDULER_HEARTBEAT_SCHEDULE'
      }
    }
  }
}
