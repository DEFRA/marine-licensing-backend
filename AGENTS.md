# AGENTS.md

Guidance for AI coding agents working in **marine-licensing-backend**, a Hapi
API for marine licensing exemptions and licences.

This file records conventions, invariants and gotchas — things the source
cannot tell you. For inventories the source can tell you (directory contents,
npm scripts, collection names, env vars, defaults, lint config), read the
source rather than trusting prose here: prose drifts, the source runs.

## Layout

`src/` is organised by domain (`exemptions/`, `marine-licences/`, `iat-*`);
each has its own `api/` (controllers, helpers, services, routes), `constants/`
and `models/` (Joi schemas). `shared/` holds cross-domain infrastructure.
`src/server.js` assembles the server. Run `ls src/` for the current layout.

To add an endpoint: controller in `src/<domain>/api/controllers/`, Joi schema
in `src/<domain>/models/`, colocated `.test.js`, and register the route in
`src/<domain>/api/index.js`.

## Requests and responses

- Controllers export `{ options: { validate: { params, payload } }, handler }`
  and return `h.response({ message: 'success', value: result }).code(200)`.
- Errors are thrown as `@hapi/boom` errors and reach the client in Boom's own
  shape, `{ statusCode, error, message }` — they are **not** wrapped in
  `{ message, value }`. `fail-action.js` rethrows Joi failures, adding
  `validation.details: [{ field, message, type }]`.
- Joi `.messages()` use semantic codes (e.g. `PROJECT_NAME_REQUIRED`), not
  prose.
- Audit fields are added to `request.payload` by an `onPreHandler` hook
  (`addAuditFields` in `src/shared/common/helpers/mongodb.js`), after
  validation: create fields on authenticated POST, update fields on
  authenticated PUT/PATCH, nothing on GET/DELETE or unauthenticated requests.

## Auth

- Read identity with `getContactId(auth)` and
  `getOrganisationIdFromAuthToken(auth)` (`src/shared/helpers/`); check
  ownership with `authorizeOwnership(collectionName)`.
- Entra ID tokens carry organisation access in
  `artifacts.decoded.relationships`, an array of colon-delimited strings
  (`'relationshipId:organisationId:orgName:...'`). The exemptions list filters
  on it.

## MongoDB

- Access via `request.db` / `server.db`; distributed locks via
  `request.locker` / `server.locker` (`lock()` returns a falsy value when the
  lock is held — always `free()` it in a `finally`).
- Collection names: the constants in
  `src/shared/common/constants/db-collections.js` are canonical. Two things
  that file cannot tell you:
  - `marine-plan-areas-simple-0001` is a simplified copy of
    `marine-plan-areas`, rebuilt at every boot by a startup plugin; the
    `0001` suffix encodes the simplify tolerance, the name and tolerance
    change only together, and the source collection is never modified.
  - `mongo-locks` and `reference-sequences` are hardcoded literals rather
    than named constants (`src/shared/common/helpers/mongodb.js`,
    `src/shared/helpers/reference-generator.js`).
- Multi-collection writes that must succeed or fail together use
  `withMongoTransaction` (`src/shared/common/helpers/mongo-transactions.js`)
  with `server.mongoClient` — pass `{ session }` to every operation in the
  callback. All environments (Docker, Vitest in-memory, CDP) run replica
  sets, so transactions work everywhere.
- From the host, the composed Mongo needs `?directConnection=true`: it is a
  single-member replica set advertising a Docker-network hostname (see README
  "MongoDB").

## Configuration

Convict schema in `src/config.js`, sub-schemas in `src/config/`. The `env:`
keys and `default:` values there are canonical — do not trust env-var names
or defaults quoted in prose anywhere, including here. Import the singleton
(`import { config } from '../config.js'`) and `config.get('section')`.

## Exemption status

**DRAFT** → **SCHEDULED** / **ACTIVE** / **EXPIRED** (date-derived, see
[docs/scheduled-jobs.md](docs/scheduled-jobs.md)) → **WITHDRAWN**. The
`EXEMPTION_STATUS` constants in `src/exemptions/constants/exemption.js` are
canonical; `SUBMITTED_STATUSES` groups the three that mean "submitted", and
code that needs "is this submitted?" tests against it, not a single status.

## Integrations

### Dynamics 365

- **Exemptions — Mongo queue:** submissions are queued in
  `exemption-dynamics-queue` and polled in-process; failures retry at a fixed
  interval (**not** exponential backoff) and then move to
  `exemption-dynamics-queue-failed`. Cadence is in the `dynamics` config
  section.
- **Marine licences — SQS:** submit, withdraw and send-consultation-response
  go to the `marine_licensing_d365_marine_licence` queue (plus `-deadletter`),
  processed by `src/shared/plugins/marine-licence-dynamics/` via
  `src/marine-licences/api/helpers/dynamics/worker-processor.js`. Per-action
  send state (`sent` / `failed`) lives on the licence under
  `dynamicsOutbound`: `submit`, `withdraw`, and one
  `send-consultation-response:<organisationId>` key per consultee, because
  each consultee responds separately. Those writes deliberately leave
  `updatedAt` alone (it is the optimistic-concurrency token) and can never
  overwrite `sent`. A withdrawal waits on the queue until its submit is
  `sent`, because standard SQS doesn't preserve order. The old
  `marine-licence-dynamics-queue` collections are no longer written.
- `DYNAMICS_ENABLED` gates both paths.

### Marine plan policies

Marine licence sites are queued (SQS) for marine plan policy lookup, processed
by `src/shared/plugins/marine-plan-policies/worker.js` via
`src/marine-licences/api/helpers/marine-plan-policies/worker-processor.js`.
If the spatial intersect returns zero policies (or only the onshore `Land`
placeholder), the worker assigns the nearest marine plan area's non-spatial
policies instead — the ECS `warn` it logs is the only record of the fallback,
plus one `info` line per site timing that site's query; nothing else is
persisted about it. Canonical explainers — keep them accurate if you change
the mechanism:

- [docs/nearest-marine-plan-area-fallback.md](docs/nearest-marine-plan-area-fallback.md)
  — fallback design, numbers and observability contract
- [docs/marine-plan-policy-supporting-documents.md](docs/marine-plan-policy-supporting-documents.md)
  — supporting documents: storage, derived status, and what a re-query does
  to links

### GOV.UK Notify

Retries are fixed-interval, **not** exponential backoff (`notify` config
section). Entry point: `src/shared/helpers/send-email-confirmation.js`.

### Outbound HTTP

When `httpProxy` is configured, `setupProxy()`
(`src/shared/common/helpers/proxy/setup-proxy.js`) routes Node's global
agents and global `fetch` through it, then points Wreck's agents at them —
Wreck otherwise uses its own agents and bypasses the proxy. Any client that
brings its own agent needs the same treatment.

## Scheduled jobs

Recurring jobs are declared in `src/shared/plugins/scheduler/scheduled-jobs.js`
and run in-process via node-cron, on exactly one instance per scheduled fire.
A missed fire is never retried, so every job must be idempotent and
backward-looking; jobs share the API's event loop, and a deployment can cut
one off mid-run. The contract and log lines are documented in
[docs/scheduled-jobs.md](docs/scheduled-jobs.md) — the canonical explainer;
keep it accurate if you change the mechanism.

## Logging (CDP ECS rules — CRITICAL)

Use the Pino singleton (`src/shared/common/helpers/logging/logger.js`). CDP
enforces a streamlined ECS schema and its ingestion pipeline **silently
drops** any field not in it, so custom keys in pino's mergingObject (the first
argument) never reach OpenSearch.

Fields code can set (the subset this codebase uses; the CDP platform team
publish the full schema):

- `message` — always visible
- `error/*` — message, stack_trace, type, code (use `structureErrorForECS()`)
- `event/action`, `event/category`, `event/kind`, `event/type`,
  `event/outcome` (`success` / `failure`), `event/reason`, `event/reference`,
  `event/duration` (nanoseconds)
- `http/*` — auto-populated from `req`/`res`

```js
// GOOD
logger.info(`Exemption deleted: ${id}`)
logger.info(
  { event: { action: 'delete', outcome: 'success' } },
  `Exemption deleted: ${id}`
)
logger.error(structureErrorForECS(error), 'Operation failed')

// BAD — silently lost in production
logger.info({ exemptionId: id, userId }, 'Deleted') // custom keys stripped
logger.info(migrationStatus, 'Migration status') // array indices become top-level keys
logger.warn({ tempDir, error }, 'Cleanup failed') // raw error, no ECS structure
```

Put meaningful context in the `message` string, and never log tokens,
passwords or PII.

## Testing

- Tests are colocated (`thing.js` + `thing.test.js`). Single file:
  `npm test -- path/to/file.test.js`.
- `clearMocks` is on in `vitest.config.js` — don't call `vi.clearAllMocks()`
  or `vi.resetAllMocks()` in test files.
- Globals from `.vite/setup-files.js`: `mockMongo` (a real in-memory MongoDB
  db), `mockMongoClient` (for code that starts sessions/transactions),
  `mockHandler` (`.response()` / `.code()` spies) and `fetchMock`.
- The test database is dropped once per file, but only the exemptions and
  marine licences collections are emptied before each test — anything else a
  test inserts is still there for the next test in the same file.
- Don't mock helper functions; pass realistic inputs instead, e.g. real auth
  objects (see `createAuthWithOrg` in
  `src/shared/api/projects/controllers/get-projects.test.js`). Mock only
  external services (S3, Notify, Dynamics).
- Use real codebase constants (`EXEMPTION_STATUS`, …) rather than string
  literals. Extract repeated mock setup into a local `setupMocks()`.
- Seed marine licences in integration tests with `insertMarineLicence(overrides)`
  / `findMarineLicence(_id)` from `tests/test-helpers.js`, not a local helper
  or inline `insertOne` / `findOne`.
- `createCompleteMarineLicence` (`tests/test.fixture.js`) includes marine plan
  policy data, with one document and its supporting documents `COMPLETED`.
  Override `marinePlanPolicyDocuments` (and the policy fields) when a test
  needs a licence without them.
- Test error paths (unauthorised, validation failure, DB error) in unit tests.
  Integration tests needn't repeat every edge case, such as each validation
  scenario.
- After a refactor, run the related unit tests.
