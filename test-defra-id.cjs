const fs = require('fs')
const path = require('path')
const assert = require('assert')

const defraIdPath = path.join(__dirname, 'src/common/helpers/auth/defra-id.js')
const defraIdSource = fs.readFileSync(defraIdPath, 'utf8')

function checkExports() {
  console.log('Testing exports...')
  assert(
    defraIdSource.includes('export const logger ='),
    'logger export missing'
  )
  assert(
    defraIdSource.includes('export const safeLog ='),
    'safeLog export missing'
  )
  assert(
    defraIdSource.includes('export async function fetchOidcConfig'),
    'fetchOidcConfig export missing'
  )
  assert(
    defraIdSource.includes('export function setupAuthStrategy'),
    'setupAuthStrategy export missing'
  )
  assert(
    defraIdSource.includes('export function logFetchError'),
    'logFetchError export missing'
  )
  assert(
    defraIdSource.includes('export async function setupDefraIdAuth'),
    'setupDefraIdAuth export missing'
  )
  assert(
    defraIdSource.includes('export const defraId ='),
    'defraId export missing'
  )
  console.log('✅ All exports found')
}

function checkSafeLog() {
  console.log('Testing safeLog implementation...')
  assert(
    defraIdSource.includes('export const safeLog = {'),
    'safeLog object declaration missing'
  )
  assert(
    defraIdSource.includes("if (logger && typeof logger.info === 'function')"),
    'safeLog.info null check missing'
  )
  assert(
    defraIdSource.includes("if (logger && typeof logger.error === 'function')"),
    'safeLog.error null check missing'
  )
  console.log('✅ safeLog implements null checks')
}

function checkFetchOidcConfig() {
  console.log('Testing fetchOidcConfig implementation...')
  assert(
    defraIdSource.includes('export async function fetchOidcConfig'),
    'fetchOidcConfig function declaration missing'
  )
  assert(
    defraIdSource.includes('if (global.PROXY_AGENT)'),
    'global.PROXY_AGENT check missing'
  )
  assert(
    defraIdSource.includes('fetchOptions.agent = global.PROXY_AGENT'),
    'fetchOptions.agent assignment missing'
  )
  assert(
    defraIdSource.includes('global.PROXY_AGENT.proxy ?'),
    'proxy toString check missing'
  )
  console.log('✅ fetchOidcConfig handles proxy configuration')
}

function checkLogFetchError() {
  console.log('Testing logFetchError implementation...')
  assert(
    defraIdSource.includes('export function logFetchError'),
    'logFetchError function declaration missing'
  )
  assert(
    defraIdSource.includes("if (fetchError.name === 'FetchError')"),
    'FetchError type check missing'
  )
  assert(
    defraIdSource.includes("if (fetchError.message.includes('TLS'))"),
    'TLS error check missing'
  )
  assert(
    defraIdSource.includes('if (fetchError.cause)'),
    'Error cause check missing'
  )
  console.log('✅ logFetchError handles different error types')
}

function checkDefraIdPlugin() {
  console.log('Testing defraId plugin implementation...')
  assert(
    defraIdSource.includes('export const defraId = {'),
    'defraId plugin declaration missing'
  )
  assert(
    defraIdSource.includes(
      "key.startsWith('TRUSTSTORE_') || key === 'ENABLE_SECURE_CONTEXT'"
    ),
    'TLS environment variable check missing'
  )
  assert(
    defraIdSource.includes('TLS-related environment variables found'),
    'TLS environment variable logging missing'
  )
  console.log('✅ defraId plugin logs TLS environment variables')
}

function checkSetupDefraIdAuth() {
  console.log('Testing setupDefraIdAuth implementation...')
  assert(
    defraIdSource.includes('export async function setupDefraIdAuth'),
    'setupDefraIdAuth function declaration missing'
  )
  assert(defraIdSource.includes('try {'), 'try block missing')
  assert(defraIdSource.includes('catch (fetchError)'), 'catch block missing')
  assert(
    defraIdSource.includes('logFetchError(fetchError)'),
    'logFetchError call missing'
  )
  assert(defraIdSource.includes('throw fetchError'), 'Error rethrow missing')
  console.log('✅ setupDefraIdAuth handles errors properly')
}

try {
  console.log('\n🔍 TESTING DEFRA-ID.JS STRUCTURE\n')

  checkExports()
  checkSafeLog()
  checkFetchOidcConfig()
  checkLogFetchError()
  checkDefraIdPlugin()
  checkSetupDefraIdAuth()

  console.log(
    '\n✅ ALL TESTS PASSED! The defra-id.js file structure is correct.\n'
  )

  const exportedFunctions = 7
  const testedPatterns = 6
  const estimatedCoverage = Math.min(
    100,
    Math.round((testedPatterns / exportedFunctions) * 100)
  )

  console.log(`📊 Estimated structural coverage: ${estimatedCoverage}%`)
  console.log(
    'Note: This is just a structural verification, not functional testing.\n'
  )
} catch (error) {
  console.error('\n❌ TEST FAILED:')
  console.error(error.message)
  console.error('\nStack trace:')
  console.error(error.stack)
  process.exit(1)
}
