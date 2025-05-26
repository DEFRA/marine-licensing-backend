import https from 'node:https'
import tls from 'node:tls'
import { getTrustStoreCerts } from '../common/helpers/secure-context/get-trust-store-certs.js'
import { HttpsProxyAgent } from 'https-proxy-agent'

export const DEFAULT_CONFIG = {
  TARGET_URL: 'cdp-defra-id-stub.test.cdp-int.defra.cloud',
  TARGET_PATH: '/cdp-defra-id-stub/.well-known/openid-configuration',
  PORT: 443,
  PROXY_URL: process.env.HTTP_PROXY || process.env.HTTPS_PROXY || null,
  TIMEOUT_MS: 10000
}

export function isTlsError(error) {
  if (!error) return false

  const TLS_ERROR_CODES = [
    'ECONNRESET',
    'CERT_HAS_EXPIRED',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'ERR_TLS_CERT_ALTNAME_INVALID',
    'CERT_SIGNATURE_FAILURE'
  ]

  if (error.code && TLS_ERROR_CODES.includes(error.code)) {
    return true
  }

  const errorMessage = error.message ? error.message.toLowerCase() : ''
  return (
    errorMessage.includes('tls') ||
    errorMessage.includes('certificate') ||
    errorMessage.includes('ssl') ||
    errorMessage.includes('handshake') ||
    errorMessage.includes('self signed') ||
    errorMessage.includes('verification')
  )
}

export function createTlsContext() {
  try {
    const trustStoreCerts = getTrustStoreCerts(process.env)
    console.log(
      `Found ${trustStoreCerts.length} certificates in environment variables`
    )

    const options = {}
    const secureContext = tls.createSecureContext(options)

    trustStoreCerts.forEach((cert, index) => {
      try {
        console.log(`Adding certificate #${index + 1} to TLS context`)
        secureContext.context.addCACert(cert)
      } catch (error) {
        console.error(
          `Failed to add certificate #${index + 1}: ${error.message}`
        )
      }
    })

    console.log('TLS context created successfully')
    return secureContext
  } catch (error) {
    console.error(`Failed to create TLS context: ${error.message}`)
    return null
  }
}

export function testDirectConnection(
  config = DEFAULT_CONFIG,
  tlsContext = null
) {
  return new Promise((resolve) => {
    console.log('\n=== Test 1: Direct HTTPS connection (no proxy) ===')

    const options = {
      hostname: config.TARGET_URL,
      port: config.PORT,
      path: config.TARGET_PATH,
      method: 'GET',
      secureContext: tlsContext,
      headers: {
        'User-Agent': 'Node.js TLS Test'
      },
      timeout: config.TIMEOUT_MS
    }

    const req = https.request(options, (res) => {
      console.log(`STATUS: ${res.statusCode}`)
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`)

      let data = ''
      res.on('data', (chunk) => {
        data += chunk.toString()
      })

      res.on('end', () => {
        console.log(`BODY: ${data.substring(0, 100)}...`)
        console.log('Test 1 completed successfully')
        resolve({ success: true, statusCode: res.statusCode, data })
      })
    })

    req.on('error', (e) => {
      console.error(`TEST 1 FAILED: ${e.message}`)
      console.error(`Error name: ${e.name}, Error code: ${e.code || 'none'}`)

      if (isTlsError(e)) {
        console.error(
          'This is a certificate validation error. Ensure your certificates are valid and properly formatted.'
        )
      } else if (e.code === 'ECONNREFUSED') {
        console.error(
          'Connection refused. The server might be down or a firewall is blocking access.'
        )
      } else if (e.code === 'ECONNRESET') {
        console.error(
          'Connection reset. This often indicates a TLS handshake failure.'
        )
      }

      resolve({ success: false, error: e })
    })

    req.on('timeout', () => {
      console.error('TEST 1 FAILED: Request timed out')
      req.destroy()
      resolve({ success: false, error: new Error('Request timed out') })
    })

    req.end()
  })
}

export function testProxyConnection(
  config = DEFAULT_CONFIG,
  tlsContext = null
) {
  return new Promise((resolve) => {
    if (!config.PROXY_URL) {
      console.log('\n=== Test 2: Skipped (no proxy configured) ===')
      resolve({ success: false, error: new Error('No proxy configured') })
      return
    }

    console.log('\n=== Test 2: Connection through proxy ===')

    try {
      const agent = new HttpsProxyAgent(config.PROXY_URL, {
        rejectUnauthorized: true,
        secureContext: tlsContext
      })

      const options = {
        hostname: config.TARGET_URL,
        port: config.PORT,
        path: config.TARGET_PATH,
        method: 'GET',
        agent,
        headers: {
          'User-Agent': 'Node.js TLS Test'
        },
        timeout: config.TIMEOUT_MS
      }

      const req = https.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`)
        console.log(`HEADERS: ${JSON.stringify(res.headers)}`)

        let data = ''
        res.on('data', (chunk) => {
          data += chunk.toString()
        })

        res.on('end', () => {
          console.log(`BODY: ${data.substring(0, 100)}...`)
          console.log('Test 2 completed successfully')
          resolve({ success: true, statusCode: res.statusCode, data })
        })
      })

      req.on('error', (e) => {
        console.error(`TEST 2 FAILED: ${e.message}`)
        console.error(`Error name: ${e.name}, Error code: ${e.code || 'none'}`)
        resolve({ success: false, error: e })
      })

      req.on('timeout', () => {
        console.error('TEST 2 FAILED: Request timed out')
        req.destroy()
        resolve({ success: false, error: new Error('Request timed out') })
      })

      req.end()
    } catch (error) {
      console.error(`TEST 2 FAILED during setup: ${error.message}`)
      resolve({ success: false, error })
    }
  })
}

export function testInsecureConnection(config = DEFAULT_CONFIG) {
  return new Promise((resolve) => {
    console.log('\n=== Test 3: Connection with TLS verification disabled ===')

    const options = {
      hostname: config.TARGET_URL,
      port: config.PORT,
      path: config.TARGET_PATH,
      method: 'GET',
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'Node.js TLS Test'
      },
      timeout: config.TIMEOUT_MS
    }

    if (config.PROXY_URL) {
      try {
        options.agent = new HttpsProxyAgent(config.PROXY_URL, {
          rejectUnauthorized: false
        })
        console.log('Using proxy with TLS verification disabled')
      } catch (error) {
        console.error(`Failed to create proxy agent: ${error.message}`)
      }
    }

    const req = https.request(options, (res) => {
      console.log(`STATUS: ${res.statusCode}`)
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`)

      let data = ''
      res.on('data', (chunk) => {
        data += chunk.toString()
      })

      res.on('end', () => {
        console.log(`BODY: ${data.substring(0, 100)}...`)
        console.log('Test 3 completed successfully')
        console.log(
          '\nIF TEST 3 SUCCEEDED BUT OTHERS FAILED: This confirms it is a certificate validation issue.'
        )
        resolve({ success: true, statusCode: res.statusCode, data })
      })
    })

    req.on('error', (e) => {
      console.error(`TEST 3 FAILED: ${e.message}`)
      console.error(`Error name: ${e.name}, Error code: ${e.code || 'none'}`)
      console.error(
        '\nIF ALL TESTS FAILED: This suggests a network connectivity issue rather than just a certificate problem.'
      )
      resolve({ success: false, error: e })
    })

    req.on('timeout', () => {
      console.error('TEST 3 FAILED: Request timed out')
      req.destroy()
      resolve({ success: false, error: new Error('Request timed out') })
    })

    req.end()
  })
}

export async function runAllTests(config = DEFAULT_CONFIG) {
  console.log('=== TLS Connection Test Utility ===')
  console.log(`Target: https://${config.TARGET_URL}${config.TARGET_PATH}`)
  console.log(`Using Proxy: ${config.PROXY_URL || 'None'}`)

  const tlsContext = createTlsContext()

  const results = {
    directConnection: await testDirectConnection(config, tlsContext),
    proxyConnection: config.PROXY_URL
      ? await testProxyConnection(config, tlsContext)
      : { skipped: true },
    insecureConnection: await testInsecureConnection(config)
  }

  return results
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
}
