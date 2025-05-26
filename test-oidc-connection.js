import fetch from 'node-fetch'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { config } from './src/config.js'

const DISABLE_TLS_VALIDATION =
  process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' || false

const OIDC_URL =
  process.env.OIDC_URL || config.get('defraIdOidcConfigurationUrl')
const PROXY_URL =
  process.env.HTTP_PROXY || process.env.HTTPS_PROXY || config.get('httpProxy')
const CDP_ENV = process.env.CDP_ENVIRONMENT || config.get('cdpEnvironment')

console.log('=== OIDC Connection Test Utility ===')
console.log(`Testing connection to: ${OIDC_URL}`)
console.log(`Environment: ${CDP_ENV}`)
console.log(`Using proxy: ${PROXY_URL || 'none'}`)
console.log(`TLS validation disabled: ${DISABLE_TLS_VALIDATION}`)

const tlsEnvVars = Object.entries(process.env).filter(
  ([key]) =>
    key.startsWith('TRUSTSTORE_') ||
    key.startsWith('NODE_TLS_') ||
    key === 'ENABLE_SECURE_CONTEXT'
)

if (tlsEnvVars.length > 0) {
  console.log('\nTLS environment variables:')
  tlsEnvVars.forEach(([key, value]) => {
    const safeValue =
      value && value.length > 10
        ? `${value.substring(0, 10)}...`
        : value || '<empty>'
    console.log(`- ${key}: ${safeValue}`)
  })
} else {
  console.log('\nNo TLS environment variables found')
}

async function testDirectConnection() {
  console.log('\n=== Test 1: Direct connection ===')
  try {
    const options = {}

    if (PROXY_URL) {
      options.agent = new HttpsProxyAgent(PROXY_URL, {
        rejectUnauthorized: !DISABLE_TLS_VALIDATION
      })
      console.log(`Using proxy agent: ${PROXY_URL}`)
    }

    if (DISABLE_TLS_VALIDATION) {
      console.log('WARNING: TLS certificate validation is DISABLED')
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    console.log(`Fetching from ${OIDC_URL}...`)
    const start = Date.now()
    const response = await fetch(OIDC_URL, options)
    const elapsed = Date.now() - start

    console.log(`Status: ${response.status} ${response.statusText}`)
    console.log(`Response time: ${elapsed}ms`)

    if (response.ok) {
      const data = await response.json()
      console.log('OIDC configuration retrieved successfully:')
      console.log(JSON.stringify(data, null, 2))
      return true
    } else {
      console.error(`Failed with status: ${response.status}`)
      return false
    }
  } catch (error) {
    console.error(`Error: ${error.message}`)
    console.error(`Error name: ${error.name}`)
    console.error(`Error code: ${error.code || 'none'}`)

    if (error.cause) {
      console.error(`Underlying error: ${error.cause.message}`)
    }

    if (
      error.message.includes('certificate') ||
      error.message.includes('SSL') ||
      error.message.includes('TLS') ||
      error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
      error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
      error.code === 'CERT_HAS_EXPIRED'
    ) {
      console.error('\nThis appears to be a TLS certificate validation issue.')
      console.error(
        'Try running with NODE_TLS_REJECT_UNAUTHORIZED=0 to bypass validation for testing.'
      )
    }

    if (
      error.message.includes('socket disconnected') ||
      error.code === 'ECONNRESET'
    ) {
      console.error('\nConnection was reset during the TLS handshake.')
      console.error('This typically happens when:')
      console.error('1. The server rejected the TLS connection')
      console.error('2. A firewall or proxy is blocking the connection')
      console.error('3. Your certificates are not trusted by the server')
    }

    return false
  }
}

async function testFallbackConnection() {
  if (DISABLE_TLS_VALIDATION) {
    console.log('\n=== Test 2: Skipped (TLS already disabled) ===')
    return false
  }

  console.log('\n=== Test 2: Connection with TLS validation disabled ===')

  const originalTlsValue = process.env.NODE_TLS_REJECT_UNAUTHORIZED

  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

    const options = {}
    if (PROXY_URL) {
      options.agent = new HttpsProxyAgent(PROXY_URL, {
        rejectUnauthorized: false
      })
    }

    console.log(`Fetching from ${OIDC_URL} with TLS validation disabled...`)
    const start = Date.now()
    const response = await fetch(OIDC_URL, options)
    const elapsed = Date.now() - start

    console.log(`Status: ${response.status} ${response.statusText}`)
    console.log(`Response time: ${elapsed}ms`)

    if (response.ok) {
      console.log(
        'OIDC configuration retrieved successfully with TLS validation disabled'
      )
      console.log('THIS CONFIRMS IT IS A CERTIFICATE VALIDATION ISSUE')
      return true
    } else {
      console.error(`Failed with status: ${response.status}`)
      return false
    }
  } catch (error) {
    console.error(`Error: ${error.message}`)
    return false
  } finally {
    if (originalTlsValue) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsValue
    } else {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
    }
  }
}

;(async () => {
  console.log('\nRunning connection tests...')

  const directResult = await testDirectConnection()

  if (!directResult) {
    await testFallbackConnection()
  }

  console.log('\nTests completed.')
})()
