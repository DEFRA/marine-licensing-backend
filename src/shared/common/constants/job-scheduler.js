// Every schedule is interpreted in UK local time, so a job pinned to 00:05 runs
// at 00:05 as the business reads the clock rather than drifting an hour for half
// the year. Deliberately not configurable: no environment of this service should
// run its jobs on another country's clock.
export const SCHEDULER_TIMEZONE = 'Europe/London'

// How long node-cron waits for a job that is mid-run before destroying tasks.
// Must stay inside hapi-pulse's 10s shutdown budget (see helpers/pulse.js).
export const SCHEDULER_SHUTDOWN_TIMEOUT_MS = 5000
