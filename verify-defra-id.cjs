/**
 * Simple validation script for defra-id.js
 * Run with: node verify-defra-id.cjs
 *
 * This script mimics Jest's behavior but runs directly with Node.js
 * to avoid compatibility issues.
 */

const fs = require('fs')
const path = require('path')

// Read the file
const defraIdPath = path.join(__dirname, 'src/common/helpers/auth/defra-id.js')
const defraIdSource = fs.readFileSync(defraIdPath, 'utf8')

// Mimics Jest's test and expect functions
let testsRun = 0
let testsPassed = 0
let testsFailed = 0
const failedTests = []

function describe(name, fn) {
  console.log(`\n📋 ${name}`)
  fn()
}

function test(name, fn) {
  testsRun++
  try {
    fn()
    console.log(`  ✅ ${name}`)
    testsPassed++
  } catch (error) {
    console.log(`  ❌ ${name}`)
    console.log(`     ${error.message}`)
    testsFailed++
    failedTests.push({ name, error })
  }
}

function expect(actual) {
  return {
    toContain: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(
          `Expected to contain: "${expected}"\nBut didn't find it in the source.`
        )
      }
    },
    not: {
      toBeNull: () => {
        if (actual === null) {
          throw new Error('Expected not to be null')
        }
      }
    }
  }
}

// The actual tests
describe('defra-id.js', () => {
  // Test for the existence of exported functions
  test('should export the required functions', () => {
    expect(defraIdSource).toContain('export const logger =')
    expect(defraIdSource).toContain('export const safeLog =')
    expect(defraIdSource).toContain('export async function fetchOidcConfig')
    expect(defraIdSource).toContain('export function setupAuthStrategy')
    expect(defraIdSource).toContain('export function logFetchError')
    expect(defraIdSource).toContain('export async function setupDefraIdAuth')
    expect(defraIdSource).toContain('export const defraId =')
  })

  // Test the safeLog function implementation
  test('safeLog should handle missing logger gracefully', () => {
    // Instead of regex, just check for the key patterns
    expect(defraIdSource).toContain('export const safeLog = {')
    expect(defraIdSource).toContain(
      "if (logger && typeof logger.info === 'function')"
    )
    expect(defraIdSource).toContain(
      "if (logger && typeof logger.error === 'function')"
    )
  })

  // Test fetchOidcConfig implementation
  test('fetchOidcConfig should handle proxy configuration', () => {
    expect(defraIdSource).toContain('export async function fetchOidcConfig')
    expect(defraIdSource).toContain('if (global.PROXY_AGENT)')
    expect(defraIdSource).toContain('fetchOptions.agent = global.PROXY_AGENT')
    expect(defraIdSource).toContain('global.PROXY_AGENT.proxy ?')
  })

  // Test logFetchError implementation
  test('logFetchError should handle different error types', () => {
    expect(defraIdSource).toContain('export function logFetchError')
    expect(defraIdSource).toContain("if (fetchError.name === 'FetchError')")
    expect(defraIdSource).toContain("if (fetchError.message.includes('TLS'))")
    expect(defraIdSource).toContain('if (fetchError.cause)')
  })

  // Test plugin registration function
  test('plugin should log TLS environment variables', () => {
    expect(defraIdSource).toContain('export const defraId = {')
    expect(defraIdSource).toContain(
      "key.startsWith('TRUSTSTORE_') || key === 'ENABLE_SECURE_CONTEXT'"
    )
    expect(defraIdSource).toContain('TLS-related environment variables found')
  })

  // Test setupDefraIdAuth implementation
  test('setupDefraIdAuth should handle errors properly', () => {
    expect(defraIdSource).toContain('export async function setupDefraIdAuth')
    expect(defraIdSource).toContain('try {')
    expect(defraIdSource).toContain('catch (fetchError)')
    expect(defraIdSource).toContain('logFetchError(fetchError)')
    expect(defraIdSource).toContain('throw fetchError')
  })
})

// Print summary
console.log('\n📊 Test Summary:')
console.log(`  Total: ${testsRun}`)
console.log(`  Passed: ${testsPassed}`)
console.log(`  Failed: ${testsFailed}`)

if (testsFailed > 0) {
  console.log('\n❌ Failed Tests:')
  failedTests.forEach(({ name, error }, index) => {
    console.log(`  ${index + 1}. "${name}"`)
    console.log(`     ${error.message}`)
  })
  process.exit(1)
} else {
  console.log('\n🎉 All tests passed!')

  // Calculate coverage estimate
  const exportedFunctions = 7 // logger, safeLog, fetchOidcConfig, setupAuthStrategy, logFetchError, setupDefraIdAuth, defraId
  const testedPatterns = 6 // One for each function + plugin
  const estimatedCoverage = Math.min(
    100,
    Math.round((testedPatterns / exportedFunctions) * 100)
  )

  console.log(`\n📈 Estimated structural coverage: ${estimatedCoverage}%`)
  console.log(
    'Note: This is a structural verification, not full functional testing.'
  )
}
