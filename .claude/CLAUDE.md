# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**marine-licensing-backend** is a Node.js backend API for managing marine licensing exemptions.

### Integrations with other systems

- **Dynamics 365** (for exemption approval workflow)
- **AWS S3** (for file storage)
- **GOV.UK Notify** (for email notifications)
- **MongoDB** (for primary data storage)

### Technology Stack

Hapi 21, Vitest, MongoDB, JWT auth (defraId/Entra ID), Pino logging

---

## Quick Commands

All npm scripts are defined in **package.json**. View them with:

```bash
npm run
```

## Architecture Overview

### Core Structure

```
src/
├── config.js              # Convict configuration schema (env vars, defaults)
├── config/                # Config sub-schemas (e.g. marine-plan-policies.js)
├── server.js              # Hapi server assembly: plugins, routes, decorations
├── index.js               # Process entry point
├── exemptions/            # Exemption domain
│   ├── api/               # controllers/, helpers/, services/, index.js (routes)
│   ├── constants/         # EXEMPTION_STATUS, EXEMPTION_STATUS_LABEL, etc.
│   └── models/            # Joi schemas
├── marine-licences/       # Marine licence domain
│   ├── api/               # controllers/, helpers/ (incl. marine-plan-policies/), csv/,
│   │                      # services/, index.js + frontend-routes.js + gateway-routes.js
│   ├── constants/
│   └── models/
├── iat-contexts/          # In-flight IAT self-service journey state (api/, models/)
├── iat-outcome-documents/ # Immutable IAT outcome snapshots (api/, models/)
├── iat-shared/            # Helpers shared across IAT (e.g. generate-slug.js)
└── shared/                # Cross-domain infrastructure
    ├── api/               # geo-parser/, projects/
    ├── common/            # constants/ (db-collections.js, etc.), helpers/ (logging,
    │                      # proxy, geo, convict, mongodb, fail-action)
    ├── constants/         # errors.js, project-status.js, site-details.js
    ├── handlers/          # shared HTTP handlers (create/update project name)
    ├── helpers/           # auth, task-list, reference-generator, email confirmation
    ├── models/            # shared Joi schemas
    ├── plugins/           # Hapi plugins: auth, dynamics, emp, geo-areas,
    │                      # marine-plan-policies, router
    ├── routes/            # health check
    └── services/          # data-service/ (S3 blob-service), geo-parser/
```

### Request Flow

1. **HTTP Request** → Hapi Server
2. **JWT Authentication** → defraId or Entra ID validation
3. **Authorization** → Ownership check (for protected endpoints)
4. **Validation** → Joi schema validation
5. **Audit Fields** → Automatically added (createdBy, createdAt, etc.)
6. **Handler** → Controller processes request
7. **Response** → Standard format: `{ message: 'success', value: {...} }`

### Database & Collections

- **Primary:** MongoDB
- **Collections** (constants in `src/shared/common/constants/db-collections.js`):
  - `exemptions`
  - `exemption-emp-queue`, `exemption-emp-queue-failed`
  - `exemption-dynamics-queue`, `exemption-dynamics-queue-failed`
  - `marine-licences`
  - `marine-licence-dynamics-queue`, `marine-licence-dynamics-queue-failed`
  - `coastal-operations-areas`
  - `marine-plan-areas` — downloaded reference data (source of truth)
  - `marine-plan-areas-simple-0001` — a simplified copy of `marine-plan-areas`, rebuilt from
    it on every server boot by a startup plugin (see below). The `0001` suffix encodes the
    simplify tolerance; name and tolerance change only together, and the source collection is
    never modified.
  - `marine-plan-policy-wording`, `marine-plan-policy-wording-snapshots`
  - `iat-contexts`, `iat-outcome-documents`
  - `mongo-locks`, `reference-sequences` — utility collections; referenced as hardcoded
    literals rather than named constants (`src/shared/common/helpers/mongodb.js`,
    `src/shared/helpers/reference-generator.js`)
- **Access:** Via `request.db` or `server.db`
- **Locking:** Distributed locks via `request.locker` or `server.locker`

---

## Key Conventions & Patterns

### Controller Pattern

```javascript
export const controllerName = {
  options: {
    validate: {
      params: joiSchema,
      payload: joiSchema
    }
  },
  handler: async (request, h) => {
    const { db, payload, auth } = request
    // Implementation
    return h.response({ message: 'success', value: result }).code(200)
  }
}
```

### Validation & Error Handling

- Use **Joi schemas** in each domain's `models/` directory (`src/exemptions/models/`,
  `src/marine-licences/models/`, `src/shared/models/`, etc.) for all input validation
- Validation errors automatically formatted by `fail-action.js`
- Use **@hapi/boom** for HTTP errors: `Boom.badRequest()`, `Boom.unauthorized()`, `Boom.conflict()`
- Custom error messages via Joi `.messages()` with semantic codes (e.g., 'PROJECT_NAME_REQUIRED')

### Authentication & Authorization

- **Token Extraction:** `getContactId(auth)` and `getOrganisationIdFromAuthToken(auth)` helpers
- **Token Structure (defraId):**
  ```javascript
  {
    credentials: { contactId: 'user-id', email: 'user@example.com' },
    artifacts: { decoded: { /* JWT claims */ } }
  }
  ```
- **Token Structure (Entra ID - with relationships):**
  ```javascript
  {
    credentials: { contactId: 'user-id', email: 'user@example.com' },
    artifacts: {
      decoded: {
        relationships: ['relationshipId:organisationId:orgName:...']
      }
    }
  }
  ```
- **Ownership Check:** Use `authorizeOwnership()` helper to verify user owns resource
- **Organisation Access:** Parse relationships array for organisation filtering (used in exemptions list)

### Testing Patterns

- Tests colocated with source: `controller.js` + `controller.test.js`
- **Global test setup** (`.vite/mongo-memory-server.js` and `.vite/setup-files.js`, wired via
  `setupFiles` in `vitest.config.js`):
  - `global.mockMongo` - In-memory MongoDB instance
  - `global.mockHandler` - Mock Hapi response object (`.response()`, `.code()`)
  - `fetchMock` - Mocked fetch for HTTP calls
- **Validation testing:** Extract `controller.options.validate.payload` and call `.validate()`
- **Handler testing:** Pass `{ db, payload, auth }` and verify mock calls
- **Realistic tokens in tests:** Use `createAuthWithOrg()` and `createAuthWithoutOrg()` helpers (NOT mocking helper functions)
- **DRY test setup:** Extract repeated mock setup into `setupMocks()` helper function

### Database Operations

- Use `request.db.collection('name')` to access MongoDB collections
- **Audit fields** automatically added on POST (createdBy, createdAt, updatedBy, updatedAt)
- **Distributed locking** for critical sections:
  ```javascript
  const lock = await request.locker.lock('resource-key')
  if (!lock) return // Lock unavailable
  try {
    /* do work */
  } finally {
    await lock.free()
  }
  ```

### Exemption Workflow

Status progression: **DRAFT** → **ACTIVE** → **SUBMITTED** (Dynamics synced)

- **DRAFT:** Initial creation, user editing
- **ACTIVE:** Ready to submit (submit endpoint triggers Dynamics sync)
- **SUBMITTED:** Synced to Dynamics 365 (queue-based async processing)

### Error Response Format

```javascript
{
  message: 'error',
  value: {
    statusCode: 400,
    error: 'Bad Request',
    message: 'Joi validation error details'
  }
}
```

---

## Configuration & Environment

### Key Environment Variables

```bash
NODE_ENV=development|production|test
MONGO_URI=mongodb://127.0.0.1:27017/
MONGO_DATABASE=marine-licensing-backend
DEFRA_ID_JWKS_URI=http://localhost:3200/.../jwks.json
ENTRA_ID_JWKS_URI=https://login.microsoftonline.com/.../keys
LOG_LEVEL=info|debug
AWS_REGION=eu-west-2
S3_ENDPOINT=http://localhost:4566  # LocalStack for local dev
CDP_UPLOAD_BUCKET=mmo-uploads
DYNAMICS_ENABLED=true
DYNAMICS_CLIENT_ID=***
DYNAMICS_CLIENT_SECRET=***
```

### Configuration Management

- **File:** `src/config.js` (Convict-based, type-safe)
- **Access:** Import the singleton directly — `import { config } from '../config.js'` — then
  `config.get('domain')`
- **Structure:** Organised by domain (defraId, entraId, mongo, aws, cdp, dynamics, notify, iat, etc.)

---

## Important Implementation Details

### Dynamics 365 Integration

- **Queue-based:** Exemptions and marine licences both queued for sync, processed
  asynchronously (shared client ID/secret, separate queue collections per domain)
- **Polling:** Default 5-minute interval (configurable via plugin options)
- **Retry logic:** Up to `DYNAMICS_MAX_RETRIES` (default 3) retries, each gated by a fixed
  `DYNAMICS_RETRY_DELAY_MS` (default 1 minute) — not exponential backoff
- **Failed items:** Moved to `exemption-dynamics-queue-failed` or
  `marine-licence-dynamics-queue-failed` (matching the source queue)
- **Feature flag:** `DYNAMICS_ENABLED` environment variable

### File Upload & S3

- **Service:** `src/shared/services/data-service/blob-service.js`
- **Max file size:** 50MB (configurable via `MAX_FILE_SIZE`)
- **Supported formats:** KML, Shapefile (ZIP), GeoJSON
- **Geo parsing:** `src/shared/services/geo-parser/geo-parser.js` extracts coordinates

### Marine Plan Policy Queue & Nearest-Area Fallback

- **Queue-based:** Marine licence sites are queued (SQS) for marine plan policy lookup and
  processed asynchronously by `src/shared/plugins/marine-plan-policies/worker.js` (dead
  letters handled by `dlq-worker.js`); job status stored on the licence
  (`MARINE_PLAN_POLICY_JOB_STATUS`: pending/computing/ready/failed).
- **Processing:** `src/marine-licences/api/helpers/marine-plan-policies/worker-processor.js`
  queries ArcGIS for spatially-intersecting policies per site.
- **Nearest-area fallback:** if that query returns zero policies (or only the onshore `Land`
  policy), the worker falls back to the nearest marine plan area's non-spatial policies —
  orchestrated by `nearest-area-fallback.js` — and logs the outcome as an ECS `warn` (this
  warning is the only record of the fallback; nothing else is persisted about it). The
  nearest-area lookup runs against the simplified `marine-plan-areas-simple-0001` collection.
- **Startup rebuild:** `src/shared/plugins/geo-areas/simplify-marine-plan-areas.js` rebuilds
  `marine-plan-areas-simple-0001` from `marine-plan-areas` on every boot, guarded by a
  distributed lock so only one instance rebuilds at a time; the source collection is never
  modified.

### Geospatial Data Parsing

- **Supported formats:** KML, Shapefile (.zip), GeoJSON
- **Coordinate systems:** Configurable (OSGB36, WGS84, etc.)
- **Output:** Normalized coordinate points with validation
- **Libraries:** proj4 (coordinate transformation), @tmcw/togeojson (KML→GeoJSON), shapefile (Shapefile parsing)

### Logging & Observability

- **Logger:** Pino singleton (`src/shared/common/helpers/logging/logger.js`)
- **HTTP request logging:** `hapi-pino` plugin (auto-enabled)
- **Log formats:**
  - Development: `pino-pretty` (colored, readable)
  - Production: `ecs` (Elastic Common Schema for CloudWatch)
- **Request tracing:** Header `x-cdp-request-id` auto-propagated
- **Metrics:** CloudWatch via `aws-embedded-metrics` (production only)

### CDP ECS Logging Rules (CRITICAL)

CDP enforces a streamlined ECS schema. The log ingestion pipeline **silently drops** any
fields not in the allowed schema. This means custom keys passed in pino's mergingObject
(the first argument) will be invisible in OpenSearch.

For the full CDP ECS schema, see: @../../cdp/cdp-documentation/how-to/logging.md

**Allowed fields that code can set (subset):**

- `message` — the log message string (always visible)
- `error/*` — error message, stack_trace, type, code (use `structureErrorForECS()` helper)
- `event/action` — specific action (e.g., "delete", "authorization_check")
- `event/category`, `event/kind`, `event/type` — event classification
- `event/outcome` — "success" or "failure"
- `event/reason` — explanation for the outcome
- `event/reference` — a reference ID tied to the event
- `event/duration` — duration in nanoseconds
- `http/*` — request/response fields (auto-populated from `req`/`res`)

**Everything else is dropped.** Custom keys like `{ userId: '...' }`, `{ tempDir: '...' }`,
`{ migrated: [...] }` will NOT appear in CDP OpenSearch.

**Correct patterns:**

```js
// Data in message string — always visible
logger.info(`Exemption deleted: ${id}`)

// ECS event fields — indexed and searchable
logger.info(
  { event: { action: 'delete', outcome: 'success' } },
  `Exemption deleted: ${id}`
)

// Errors — use structureErrorForECS() to map to error/* fields
logger.error(structureErrorForECS(error), 'Operation failed')
```

**Incorrect patterns (data silently lost in production):**

```js
// BAD: custom keys stripped by CDP
logger.info({ exemptionId: id, userId }, 'Deleted')

// BAD: array as first arg — indices spread as nonsensical top-level keys
logger.info(migrationStatus, 'Migration status')

// BAD: raw error object without ECS structure
logger.warn({ tempDir, error }, 'Cleanup failed')
```

**Review checklist for logging:**

- [ ] No custom keys in pino's mergingObject — use `message` string or ECS `event/*` fields
- [ ] Arrays never passed as first argument to logger
- [ ] Errors use `structureErrorForECS()` (from `logger.js`)
- [ ] No sensitive data (tokens, passwords, PII) in log messages
- [ ] Meaningful context is in the `message` string, not lost in custom keys

### Email Notifications

- **Service:** GOV.UK Notify API
- **Configuration:** Template IDs for user and organisation emails
- **Retry:** Fixed-interval retries (`NOTIFY_RETRIES`, `NOTIFY_RETRY_INTERVAL_SECONDS`), not
  exponential backoff
- **Usage:** `src/shared/helpers/send-email-confirmation.js`

### Proxy & Network

- **Default proxy agent:** `undici` ProxyAgent (configured in `src/shared/common/helpers/proxy/setup-proxy.js`)
- **HTTP clients:** Use `undici.fetch()` or `@hapi/wreck` for automatic proxy support
- **Custom clients:** Pass `dispatcher: new ProxyAgent({...})` explicitly

---

## Testing Guidelines

Tests are run via npm scripts (see package.json). Key patterns:

- Run all tests: `npm test`
- Single test file: `npm test -- src/exemptions/api/controllers/create-project-name.test.js`
- Watch mode: `npm run test:watch`

### Test Structure Best Practices

1. **Setup realistic data:** Use actual constants from the codebase (EXEMPTION_STATUS, EXEMPTION_STATUS_LABEL)
2. **Mock external dependencies:** Mock S3, Notify, Dynamics APIs
3. **Use real helpers:** Don't mock helper functions - test them with realistic tokens/inputs
4. **Test error paths:** Include tests for unauthorized access, validation failures, database errors
5. **Avoid duplication:** Extract repeated mock setup into helper functions (e.g., `setupMocks()`, `createAuthWithOrg()`)
6. **Don't add `vi.clearAllMocks()`** to individual test files - it's already set in vitest config

### Expected Coverage

- Controllers: 100% (all handlers and error cases)
- Helpers: 100% (all auth, validation, transformation logic)
- Models: 100% (all validation schemas)
- Services: High coverage (geospatial processing, S3 operations)

---

## Common Development Tasks

### Adding a New Endpoint

1. Create controller: `src/exemptions/api/controllers/{action}.js` (or the equivalent
   domain directory, e.g. `src/marine-licences/api/controllers/`)
2. Add Joi schema: `src/exemptions/models/{entity}.js` (or the equivalent domain directory)
3. Create test: `src/exemptions/api/controllers/{action}.test.js`
4. Register route: `src/exemptions/api/index.js`
5. Implement handler logic and validation

### Updating Exemption Status Workflow

- Update `EXEMPTION_STATUS` constant in `src/exemptions/constants/exemption.js`
- Update `EXEMPTION_STATUS_LABEL` for display labels
- Update status transitions in relevant controllers
- Update `createTaskList()` helper to reflect new task states

### Working with MongoDB Transactions

- Use distributed locks for atomic multi-collection updates
- Example: Reference number generation uses lock pattern
- For complex transactions, consider refactoring to lock critical sections

### Debugging

- **Dev server debugger:** `npm run dev:debug` (Node debugger on 0.0.0.0:9229)
- **Logs:** Check Pino logs in development (pretty-printed)
- **Request context:** Included in all logs via request tracing
- **Database:** Connect to MongoDB directly via configured URI

---

## Code Quality & Standards

### Linting & Formatting

- **ESLint:** neostandard (modern JavaScript standards)
- **Prettier:** Auto-format on pre-commit hook
- **Config:** `eslint.config.js`, `.prettierrc.js`
- **Windows issue:** If Prettier breaks on line endings, run: `git config --global core.autocrlf false`

### Pre-commit Hooks (Husky)

- **Automatically run:** `lint` + `format:check`
- **Manual trigger:** `npm run git:pre-commit-hook`
- **Skip (not recommended):** `git commit --no-verify`

---

## Troubleshooting

### MongoDB Connection Issues

- Verify `MONGO_URI` environment variable
- Check MongoDB is running: `docker compose up -d` (includes MongoDB)
- Test connection: `mongo mongodb://127.0.0.1:27017/marine-licensing-backend`

### S3/LocalStack Issues

- Ensure LocalStack is running: `docker compose up -d`
- Verify `S3_ENDPOINT` points to LocalStack
- Check bucket exists: Use AWS CLI against LocalStack

### Authentication Failures

- Verify JWKS URIs are accessible: `curl $DEFRA_ID_JWKS_URI`
- Check JWT token validity and expiration
- Ensure `contactId` is present in token credentials

### Tests Failing with Mocks

- Don't mock helper functions - pass realistic tokens instead
- Use `setupMocks()` pattern to avoid duplication
- Ensure MongoDB test instance is running (handled by vitest setup)

### Hot-reload Not Working

- Restart `npm run dev` if code changes aren't picked up
- Check nodemon is configured correctly in `package.json`
- Verify file permissions allow watching

---

## Performance Considerations

### Database

- Use indexed fields for frequent queries (contactId, status)
- Batch operations when possible
- Implement pagination for list endpoints

### File Processing

- Geospatial parsing is CPU-intensive; consider worker threads for large files
- S3 operations use configurable timeouts
- ZIP extraction limited to max file size

### Dynamics Sync

- Queue-based async processing prevents blocking
- Retry logic with a fixed retry delay (not exponential backoff)
- Failed items logged for investigation

### Logging

- Production uses ECS format for CloudWatch optimization
- Request IDs enable distributed tracing
- Log level configurable via environment

---

## Related Documentation

- **README.md** - Setup, Docker, SonarCloud instructions
- **package.json** - All npm scripts and dependencies
- **sonar-project.properties** - SonarCloud configuration
- **Dockerfile** - Multi-stage build (development and production)
- **.github/dependabot.yml** - Dependency updates configuration
- After a refactor, ensure any related unit tests pass
- When adding integration tests, not every edge case needs to be covered ie don't cover every validation scenario. Those will be covered by lower level unit tests.
- Don't call vi.resetAllMocks() in individual test files because clearMocks is already set in vitest config
