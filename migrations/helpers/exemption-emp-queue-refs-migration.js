import { collectionEmpQueue } from '../../src/shared/common/constants/db-collections.js'

export const MIGRATION_LOG_PREFIX =
  '[20260421120000-clear-exemption-emp-queue-refs]'

export const DEFAULT_REFS_CONFIG_PATH =
  'exploreMarinePlanning.clearExemptionEmpQueueRefsForMigration'

export const parseApplicationReferenceList = (value) => {
  if (value == null || typeof value !== 'string' || !value.trim()) {
    return []
  }

  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * @param {(path: string) => unknown} configGet
 * @param {NodeJS.ProcessEnv} [env]
 * @param {(message: string) => void} [errorLog] defaults to `console.error`
 * @returns {string[]}
 */
export const getReferenceListFromConfig = (
  configGet,
  env = process.env,
  errorLog = (m) => {
    // eslint-disable-next-line no-console
    console.error(m)
  }
) => {
  const pathOverride = env.MIGRATION_EMP_QUEUE_REFS_CONFIG_PATH?.trim()
  const sourcePath = pathOverride || DEFAULT_REFS_CONFIG_PATH

  try {
    const raw = configGet(sourcePath)

    if (raw != null && typeof raw !== 'string') {
      errorLog(
        `${MIGRATION_LOG_PREFIX} value at config path "${sourcePath}" is not a string; skipping.`
      )
      return []
    }

    return parseApplicationReferenceList(raw)
  } catch (error) {
    errorLog(
      `${MIGRATION_LOG_PREFIX} failed to read config (check MIGRATION_EMP_QUEUE_REFS_CONFIG_PATH and schema): ${error.message}`
    )
    return []
  }
}

/**
 * @param {import('mongodb').Db} db
 * @param {object} options
 * @param {(path: string) => unknown} options.configGet
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {string} [options.collection] collection name (default: exemption-emp-queue)
 * @param {{ info: (m: string) => void, error: (m: string) => void }} [options.log] if omitted, uses console
 */
export const upClearExemptionEmpQueue = async (db, options) => {
  const {
    configGet,
    env = process.env,
    collection = collectionEmpQueue,
    log: logOption
  } = options
  const logInfo = logOption?.info
  const logError = logOption?.error
  const errorLog = logError
    ? (m) => logError(m)
    : (m) => {
        // eslint-disable-next-line no-console
        console.error(m)
      }
  const infoLog = logInfo
    ? (m) => logInfo(m)
    : (m) => {
        // eslint-disable-next-line no-console
        console.info(m)
      }

  const refs = getReferenceListFromConfig(configGet, env, errorLog)
  if (refs.length === 0) {
    return
  }

  const result = await db.collection(collection).deleteMany({
    applicationReferenceNumber: { $in: refs }
  })

  if (result.deletedCount > 0) {
    infoLog(
      `${MIGRATION_LOG_PREFIX} exemption-emp-queue: removed ${result.deletedCount} document(s) for applicationReferenceNumber in [${refs.join(', ')}]`
    )
  } else {
    infoLog(
      `${MIGRATION_LOG_PREFIX} exemption-emp-queue: no documents removed for applicationReferenceNumber in [${refs.join(', ')}]`
    )
  }
}
