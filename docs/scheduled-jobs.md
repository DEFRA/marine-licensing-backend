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
up to `SCHEDULER_SHUTDOWN_TIMEOUT_MS` in
`src/shared/common/constants/job-scheduler.js` (5s, inside hapi-pulse's 10s
budget) for a job that is mid-run. `task.destroy()` alone would abandon it, and
the Mongo client is force-closed when the server stops — so a job that cannot
finish inside that window must still be safe to cut off partway. Idempotency
covers that.

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

Everything lives in the `scheduler` config, `src/config/scheduler.js`, which is
canonical — the values below are a snapshot for orientation:

| Key                        | Default     | Environment variable           |
| -------------------------- | ----------- | ------------------------------ |
| `isEnabled`                | `true`      | `SCHEDULER_ENABLED`            |
| `jobs.heartbeat.isEnabled` | `true`      | `SCHEDULER_HEARTBEAT_ENABLED`  |
| `jobs.heartbeat.schedule`  | `5 0 * * *` | `SCHEDULER_HEARTBEAT_SCHEDULE` |

`isEnabled` is the master switch: when false nothing is scheduled, but every job
body stays invokable via its server method. Each job adds its own
`isEnabled`/`schedule` pair, so a job can be switched off without touching the
rest.

Schedules are validated at startup for syntax only. Any cadence is allowed — the
scheduler is shared infrastructure and does not police how often a job runs.

Schedules are always interpreted in `Europe/London`. That is fixed in code as
`SCHEDULER_TIMEZONE` in `src/shared/common/constants/job-scheduler.js` rather
than configured: no environment of this service should run its jobs on another
country's clock. If it ever becomes configurable again it needs validation with
it — `Intl` accepts legacy abbreviations and resolves them somewhere unrelated
(`BST` is `Asia/Dhaka`), so a bad value would run jobs at the wrong time rather
than fail at startup.

### British Summer Time caveat, not enforced

Schedules are interpreted in `Europe/London`, which has no 01:00-01:59 on the last
Sunday in March and has it twice on the last Sunday in October. A schedule naming
that hour therefore misses a fire once a year and may double up once a year.
Because jobs are idempotent and backward-looking a missed fire is normally picked
up by the next run — but if that is not acceptable for your job, pick an hour
outside 01:00-01:59. 00:05 is a safe default.

## Observability

Every line a run emits uses `event.action` `scheduler:<jobName>`, so one filter
gets a job's whole history. `event.reference` is the fire slot as an ISO
timestamp, which is also the suffix of the `scheduled-job-runs` `_id` for that
fire — so a log line and the record of which instance claimed it can be matched
up directly.

| `event.outcome` | `event.reason`                   | Level | Meaning                                                                                                                                                 |
| --------------- | -------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unknown`       | —                                | info  | The run started. Not an outcome; see below.                                                                                                             |
| `success`       | —                                | info  | Completed. Carries `event.duration` in nanoseconds, and the job's summary in `message`.                                                                 |
| `failure`       | —                                | error | The job threw. Carries `event.duration` and the ECS `error.*` fields.                                                                                   |
| `unknown`       | `not-elected`                    | info  | Another instance won this fire. Normal on every instance but one.                                                                                       |
| `failure`       | `coordinator-error`              | error | The coordinator itself failed, so the run was abandoned rather than risked.                                                                             |
| `failure`       | `Missed fires are not retried…`  | warn  | The fire was missed entirely and will not be retried.                                                                                                   |
| `failure`       | `Previous run had not finished…` | warn  | The previous run was still going, so this fire was blocked.                                                                                             |
| `unknown`       | `Enabled by configuration`       | info  | Logged once at startup for each job that was armed. `message` names the cron expression and timezone. No `event.reference`, since there is no fire yet. |
| `unknown`       | `Disabled by configuration`      | info  | The job was not scheduled. No `event.reference`, since there is no fire.                                                                                |

Switching the scheduler off globally logs once at startup under
`event.action` `scheduler:startup` rather than under a job name, since no job
got as far as being considered.

Between them the enabled and disabled lines mean every job accounts for itself at
every boot, so "is this job actually armed in this environment, and when does it
fire?" is answerable from the logs alone. `event.reason` is deliberately one of
two constant values rather than carrying the schedule, so it stays usable as an
aggregation facet; the schedule lives in `message`.

**The start line is deliberately not an outcome.** A run killed mid-flight — a
deployment overlapping the fire, an OOM — emits no outcome event at all, so
without it that case is indistinguishable from an instance that was never
elected. A start with no matching completion is the only signal that something
died holding the run. Election happens before the start line, so only the
instance that actually took the fire logs one.

**Expect two lines per failure.** node-cron is given the same logger, and logs
the raw error itself before emitting the event this maps. That line has no
`event.*` fields; the ECS line is the one to query on.

There is no allowlisted numeric ECS field for "items processed", so counts go in
the `message` string, which always survives the CDP ingestion pipeline.

## Triggering a job by hand

Every job body is registered as a Hapi server method whether or not scheduling is
enabled, so it can be run without waiting on or manipulating timers:

```js
await server.methods.runSchedulerHeartbeat()
```
