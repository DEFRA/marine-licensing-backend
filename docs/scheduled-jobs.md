# Scheduled jobs

Jobs are declared in `src/shared/plugins/scheduler/scheduled-jobs.js` and run via
node-cron from `src/shared/plugins/scheduler/index.js`. Adding one means adding an
entry to that array and a matching entry under `scheduler.jobs` in
`src/config/scheduler.js` — nothing else.

## Execution guarantee

At-most-once execution per scheduled fire, with no catch-up. A fire missed because
every instance was down — typically a deployment overlapping the scheduled time —
is never retried.

Every job must therefore be **idempotent and backward-looking**: query for all
outstanding work, never for work that arrived since the last run. A job that
processes a delta will silently lose a day's worth of work on any missed fire.

If the coordination store is unavailable at fire time the run is skipped rather
than executed unilaterally, so a Mongo outage overlapping the schedule costs that
run rather than risking two instances taking it.

## Runtime constraints

Jobs run inside the API service, on the same event loop as request handling. That
makes runtime a first-class constraint, not a tuning problem: seconds of work is
fine, a job whose runtime approaches minutes belongs in a dedicated scheduled-job
service. CDP kills an instance whose `/health` endpoint stops responding.

If you find yourself wanting to widen `RUN_RECORD_TTL_MS`, that is the signal to
re-home the job. The TTL is a garbage collection horizon, not a lease, and no
correct job needs it raised.

## Shutdown

`onPreStop` calls node-cron's `shutdown()`, which stops the timers and then waits
up to `SCHEDULER_SHUTDOWN_TIMEOUT_MS` (5s, inside hapi-pulse's 10s budget) for a
job that is mid-run. `task.destroy()` alone would abandon it, and the Mongo client
is force-closed when the server stops — so a job that cannot finish inside that
window must still be safe to cut off partway. Idempotency covers that.

## Overlap protection is per instance, not per fleet

node-cron's `noOverlap` stops one instance starting a fire while its own previous
run is still going. It does nothing across instances: an instance that lost the
election for fire N is idle, so it can legitimately win fire N+1 and start it
while another instance is still working on N.

This cannot happen to a daily job — it would need a run lasting over 24 hours. It
becomes reachable as soon as a job's runtime can exceed its interval, which is
possible for the sub-daily cadences the schedule validator allows. If you add such
a job, either keep its runtime comfortably inside its interval or give the job body
its own guard; the scheduler does not provide one.

## Configuration

| Variable                   | Purpose                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `SCHEDULER_ENABLED`        | Master switch. When false nothing is scheduled, but every job body stays invokable via its server method. |
| `SCHEDULER_TIMEZONE`       | Canonical IANA timezone every schedule is interpreted in. Defaults to `Europe/London`.                    |
| `SCHEDULER_<JOB>_ENABLED`  | Per-job switch, e.g. `SCHEDULER_HEARTBEAT_ENABLED`.                                                       |
| `SCHEDULER_<JOB>_SCHEDULE` | Per-job cron expression, e.g. `SCHEDULER_HEARTBEAT_SCHEDULE`.                                             |

Schedules are validated at startup for syntax only. Any cadence is allowed — the
scheduler is shared infrastructure and does not police how often a job runs.

`SCHEDULER_TIMEZONE` must be a canonical IANA name. Abbreviations are rejected
deliberately: `Intl` accepts them and resolves them somewhere unrelated (`BST` is
`Asia/Dhaka`, not `Europe/London`), so accepting one would run every job in a
timezone nobody chose.

### British Summer Time caveat, not enforced

Schedules are interpreted in `Europe/London`, which has no 01:00-01:59 on the last
Sunday in March and has it twice on the last Sunday in October. A schedule naming
that hour therefore misses a fire once a year and may double up once a year.
Because jobs are idempotent and backward-looking a missed fire is normally picked
up by the next run — but if that is not acceptable for your job, pick an hour
outside 01:00-01:59. 00:05 is a safe default.

## Triggering a job by hand

Every job body is registered as a Hapi server method whether or not scheduling is
enabled, so it can be run without waiting on or manipulating timers:

```js
await server.methods.runSchedulerHeartbeat()
```
