#!/usr/bin/env node

import https from 'node:https'
import Wreck from '@hapi/wreck'

console.log('=== BASIC HTTP CLIENT DIAGNOSTIC ===')
console.log(
  'Testing basic HTTP client functionality without custom proxy/TLS setup\n'
)

const TEST_URL =
  'https://cdp-defra-id-stub.test.cdp-int.defra.cloud/cdp-defra-id-stub'
const OIDC_URL =
  'https://cdp-defra-id-stub.test.cdp-int.defra.cloud/cdp-defra-id-stub/.well-known/openid-configuration'

console.log(`Target URL: ${TEST_URL}`)
console.log(`OIDC URL: ${OIDC_URL}`)
console.log(`Node.js version: ${process.version}`)
console.log(`Platform: ${process.platform}`)
console.log(`Environment: ${process.env.NODE_ENV || 'not set'}`)

async function testNativeHttps() {
  console.log('\n=== TEST 1: Native Node.js HTTPS ===')

  return new Promise((resolve) => {
    const url = new URL(TEST_URL)

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'GET',
      timeout: 10000,
      headers: {
        'User-Agent': 'Node.js Basic Test'
      }
    }

    console.log(`Making request to: ${url.hostname}${url.pathname}`)

    const req = https.request(options, (res) => {
      console.log(`✅ Status: ${res.statusCode} ${res.statusMessage}`)
      console.log(`✅ Headers: ${JSON.stringify(res.headers, null, 2)}`)

      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        console.log(`✅ Response length: ${data.length} bytes`)
        if (data.length < 500) {
          console.log(`✅ Response body: ${data}`)
        } else {
          console.log(
            `✅ Response body (first 200 chars): ${data.substring(0, 200)}...`
          )
        }
        resolve(true)
      })
    })

    req.on('error', (error) => {
      console.log(`❌ Native HTTPS failed: ${error.message}`)
      console.log(`❌ Error code: ${error.code || 'unknown'}`)
      console.log(`❌ Error stack: ${error.stack}`)
      resolve(false)
    })

    req.on('timeout', () => {
      console.log('❌ Native HTTPS timed out')
      req.destroy()
      resolve(false)
    })

    req.end()
  })
}

async function testWreckBasic() {
  console.log('\n=== TEST 2: Wreck (Basic) ===')

  try {
    console.log(`Making Wreck request to: ${TEST_URL}`)

    const { res, payload } = await Wreck.get(TEST_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Wreck Basic Test'
      }
    })

    console.log(`✅ Status: ${res.statusCode} ${res.statusMessage}`)
    console.log(`✅ Headers: ${JSON.stringify(res.headers, null, 2)}`)

    const text = payload.toString()
    console.log(`✅ Response length: ${text.length} bytes`)

    if (text.length < 500) {
      console.log(`✅ Response body: ${text}`)
    } else {
      console.log(
        `✅ Response body (first 200 chars): ${text.substring(0, 200)}...`
      )
    }

    return true
  } catch (error) {
    console.log(`❌ Wreck failed: ${error.message}`)
    console.log(`❌ Error name: ${error.name}`)
    console.log(`❌ Error code: ${error.code || 'unknown'}`)

    if (error.isBoom) {
      console.log(`❌ Boom error: ${JSON.stringify(error.output, null, 2)}`)
    }

    console.log(`❌ Error stack: ${error.stack}`)
    return false
  }
}

async function testOidcEndpoint() {
  console.log('\n=== TEST 3: OIDC Endpoint (Wreck) ===')

  try {
    console.log(`Making Wreck request to OIDC endpoint: ${OIDC_URL}`)

    const { res, payload } = await Wreck.get(OIDC_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'OIDC Test'
      }
    })

    console.log(`✅ Status: ${res.statusCode} ${res.statusMessage}`)

    if (res.statusCode === 200) {
      const oidcConfig = JSON.parse(payload.toString())
      console.log(`✅ OIDC Configuration retrieved successfully`)
      console.log(`✅ Issuer: ${oidcConfig.issuer || 'not found'}`)
      console.log(
        `✅ Authorization endpoint: ${oidcConfig.authorization_endpoint || 'not found'}`
      )
      console.log(
        `✅ Token endpoint: ${oidcConfig.token_endpoint || 'not found'}`
      )
      console.log(
        `✅ End session endpoint: ${oidcConfig.end_session_endpoint || 'not found'}`
      )
    } else {
      console.log(`⚠️  Unexpected status code: ${res.statusCode}`)
    }

    return true
  } catch (error) {
    console.log(`❌ OIDC endpoint test failed: ${error.message}`)
    console.log(`❌ Error name: ${error.name}`)
    console.log(`❌ Error code: ${error.code || 'unknown'}`)

    if (error.message.includes('socket disconnected')) {
      console.log(`🎯 This is the exact error you're seeing in deployment!`)
    }

    if (error.isBoom) {
      console.log(`❌ Boom error: ${JSON.stringify(error.output, null, 2)}`)
    }

    console.log(`❌ Error stack: ${error.stack}`)
    return false
  }
}

function testEnvironment() {
  console.log('\n=== TEST 4: Environment Check ===')

  console.log('Environment variables that might affect HTTP requests:')

  const relevantEnvVars = [
    'NODE_ENV',
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'NO_PROXY',
    'NODE_TLS_REJECT_UNAUTHORIZED',
    'ENABLE_SECURE_CONTEXT',
    'ENVIRONMENT'
  ]

  relevantEnvVars.forEach((varName) => {
    const value = process.env[varName]
    if (value) {
      console.log(`✅ ${varName}: ${value}`)
    } else {
      console.log(`➖ ${varName}: (not set)`)
    }
  })

  console.log('\nTLS-related environment variables:')
  const tlsVars = Object.keys(process.env).filter(
    (key) =>
      key.startsWith('TRUSTSTORE_') ||
      key.startsWith('NODE_TLS_') ||
      key.includes('SSL') ||
      key.includes('TLS')
  )

  if (tlsVars.length > 0) {
    tlsVars.forEach((varName) => {
      const value = process.env[varName]
      const safeValue =
        value && value.length > 20 ? `${value.substring(0, 20)}...` : value
      console.log(`✅ ${varName}: ${safeValue}`)
    })
  } else {
    console.log('➖ No TLS-related environment variables found')
  }

  return true
}

async function runBasicTests() {
  console.log('\n' + '='.repeat(60))
  console.log('RUNNING BASIC HTTP CLIENT TESTS...')
  console.log('='.repeat(60))

  const results = {
    nativeHttps: await testNativeHttps(),
    wreckBasic: await testWreckBasic(),
    oidcEndpoint: await testOidcEndpoint(),
    environment: testEnvironment()
  }

  console.log('\n' + '='.repeat(60))
  console.log('TEST RESULTS SUMMARY')
  console.log('='.repeat(60))

  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL'
    console.log(`${test.padEnd(20)}: ${status}`)
  })

  console.log('\n' + '='.repeat(60))
  console.log('ANALYSIS')
  console.log('='.repeat(60))

  const passedTests = Object.values(results).filter(Boolean).length
  const totalTests = Object.keys(results).length - 1

  if (passedTests === totalTests) {
    console.log('🎉 All HTTP clients work fine!')
    console.log(
      '   - The issue might be environment-specific in your deployment'
    )
    console.log(
      '   - Check if your deployment environment has different network policies'
    )
    console.log('   - The problem might be intermittent or load-related')
  } else if (results.nativeHttps && !results.wreckBasic) {
    console.log('🔍 Native HTTPS works but Wreck fails')
    console.log('   - This suggests an issue with Wreck specifically')
    console.log('   - Check Wreck version compatibility')
    console.log('   - The issue might be in how Wreck handles the connection')
  } else if (!results.nativeHttps) {
    console.log('🔥 Basic connectivity issue detected')
    console.log('   - Even native Node.js HTTPS fails')
    console.log('   - This is a fundamental network/DNS/firewall issue')
    console.log('   - Check network connectivity to the target host')
  } else if (!results.oidcEndpoint) {
    console.log('🎯 OIDC endpoint specifically fails')
    console.log('   - This is the exact issue your application faces')
    console.log('   - The OIDC endpoint might have specific requirements')
    console.log(
      '   - Check if the endpoint requires specific headers or authentication'
    )
  }

  console.log(
    "If all tests pass locally but fail in deployment, it's an environment issue"
  )
}

runBasicTests().catch((error) => {
  console.error('\n❌ Test script failed:', error.message)
  console.error(error.stack)
  process.exit(1)
})
