// TLS Connection Test Utility
// This script tests direct TLS connectivity to the OIDC endpoint
import https from 'node:https'
import tls from 'node:tls'
import { getTrustStoreCerts } from './src/common/helpers/secure-context/get-trust-store-certs.js'
import { HttpsProxyAgent } from 'https-proxy-agent'

// Configuration - replace these with your actual values
const TARGET_URL = 'cdp-defra-id-stub.test.cdp-int.defra.cloud'
const TARGET_PATH = '/cdp-defra-id-stub/.well-known/openid-configuration'
const PORT = 443
const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || null

console.log('=== TLS Connection Test Utility ===')
console.log(`Target: https://${TARGET_URL}${TARGET_PATH}`)
console.log(`Using Proxy: ${PROXY_URL || 'None'}`)

// Load custom certificates from environment
const trustStoreCerts = getTrustStoreCerts(process.env)
console.log(
  `Found ${trustStoreCerts.length} certificates in environment variables`
)

// Setup TLS context with custom certificates
let tlsContext
try {
  const options = {}
  const secureContext = tls.createSecureContext(options)

  trustStoreCerts.forEach((cert, index) => {
    try {
      console.log(`Adding certificate #${index + 1} to TLS context`)
      secureContext.context.addCACert(cert)
    } catch (error) {
      console.error(`Failed to add certificate #${index + 1}: ${error.message}`)
    }
  })

  tlsContext = secureContext
  console.log('TLS context created successfully')
} catch (error) {
  console.error(`Failed to create TLS context: ${error.message}`)
}

// Test 1: Direct connection without proxy
console.log('\n=== Test 1: Direct HTTPS connection (no proxy) ===')
testDirectConnection()

// Test 2: Connection through proxy if available
if (PROXY_URL) {
  console.log('\n=== Test 2: Connection through proxy ===')
  testProxyConnection()
}

// Test 3: Connection with TLS verification disabled
console.log('\n=== Test 3: Connection with TLS verification disabled ===')
testInsecureConnection()

function testDirectConnection() {
  const options = {
    hostname: TARGET_URL,
    port: PORT,
    path: TARGET_PATH,
    method: 'GET',
    secureContext: tlsContext,
    headers: {
      'User-Agent': 'Node.js TLS Test'
    },
    timeout: 10000 // 10 seconds timeout
  }

  const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`)
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`)

    res.on('data', (chunk) => {
      console.log(`BODY: ${chunk.toString().substring(0, 100)}...`)
    })

    res.on('end', () => {
      console.log('Test 1 completed successfully')
    })
  })

  req.on('error', (e) => {
    console.error(`TEST 1 FAILED: ${e.message}`)
    console.error(`Error name: ${e.name}, Error code: ${e.code || 'none'}`)
    if (
      e.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
      e.code === 'CERT_HAS_EXPIRED'
    ) {
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
  })

  req.on('timeout', () => {
    console.error('TEST 1 FAILED: Request timed out')
    req.destroy()
  })

  req.end()
}

function testProxyConnection() {
  try {
    const agent = new HttpsProxyAgent(PROXY_URL, {
      rejectUnauthorized: true,
      secureContext: tlsContext
    })

    const options = {
      hostname: TARGET_URL,
      port: PORT,
      path: TARGET_PATH,
      method: 'GET',
      agent,
      headers: {
        'User-Agent': 'Node.js TLS Test'
      },
      timeout: 10000 // 10 seconds timeout
    }

    const req = https.request(options, (res) => {
      console.log(`STATUS: ${res.statusCode}`)
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`)

      res.on('data', (chunk) => {
        console.log(`BODY: ${chunk.toString().substring(0, 100)}...`)
      })

      res.on('end', () => {
        console.log('Test 2 completed successfully')
      })
    })

    req.on('error', (e) => {
      console.error(`TEST 2 FAILED: ${e.message}`)
      console.error(`Error name: ${e.name}, Error code: ${e.code || 'none'}`)
    })

    req.on('timeout', () => {
      console.error('TEST 2 FAILED: Request timed out')
      req.destroy()
    })

    req.end()
  } catch (error) {
    console.error(`TEST 2 FAILED during setup: ${error.message}`)
  }
}

function testInsecureConnection() {
  const options = {
    hostname: TARGET_URL,
    port: PORT,
    path: TARGET_PATH,
    method: 'GET',
    rejectUnauthorized: false, // Disable certificate validation
    headers: {
      'User-Agent': 'Node.js TLS Test'
    },
    timeout: 10000 // 10 seconds timeout
  }

  // Use proxy if available
  if (PROXY_URL) {
    try {
      options.agent = new HttpsProxyAgent(PROXY_URL, {
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

    res.on('data', (chunk) => {
      console.log(`BODY: ${chunk.toString().substring(0, 100)}...`)
    })

    res.on('end', () => {
      console.log('Test 3 completed successfully')
      console.log(
        '\nIF TEST 3 SUCCEEDED BUT OTHERS FAILED: This confirms it is a certificate validation issue.'
      )
    })
  })

  req.on('error', (e) => {
    console.error(`TEST 3 FAILED: ${e.message}`)
    console.error(`Error name: ${e.name}, Error code: ${e.code || 'none'}`)
    console.error(
      '\nIF ALL TESTS FAILED: This suggests a network connectivity issue rather than just a certificate problem.'
    )
  })

  req.on('timeout', () => {
    console.error('TEST 3 FAILED: Request timed out')
    req.destroy()
  })

  req.end()
}
