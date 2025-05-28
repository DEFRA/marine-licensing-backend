#!/usr/bin/env node

import https from 'https'
import Wreck from '@hapi/wreck'

const OIDC_URL =
  process.env.DEFRA_ID_OIDC_CONFIGURATION_URL ||
  'https://login.microsoftonline.com/6c448d90-4ca1-4caf-ab59-0a2aa67d7755/v2.0/.well-known/openid_configuration'

console.log('🔍 Basic HTTP Client Diagnostic Tool')
console.log('=====================================')
console.log(`Target URL: ${OIDC_URL}`)
console.log(`Node.js Version: ${process.version}`)
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
console.log('')

async function testNativeHttps() {
  console.log('TEST 1: Native Node.js HTTPS (baseline connectivity)')
  console.log('---------------------------------------------------')

  return new Promise((resolve) => {
    const url = new URL(OIDC_URL)

    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'GET',
        timeout: 10000
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          console.log(`✅ Status: ${res.statusCode}`)
          console.log(`✅ Headers: ${JSON.stringify(res.headers, null, 2)}`)
          try {
            const json = JSON.parse(data)
            console.log(
              `✅ Response: Valid JSON with ${Object.keys(json).length} keys`
            )
            console.log(`✅ Issuer: ${json.issuer || 'not found'}`)
          } catch (e) {
            console.log(`❌ Response: Invalid JSON - ${e.message}`)
          }
          resolve()
        })
      }
    )

    req.on('error', (error) => {
      console.log(`❌ Native HTTPS Error: ${error.message}`)
      console.log(`❌ Error Code: ${error.code || 'none'}`)
      console.log(`❌ Error Name: ${error.name}`)
      resolve()
    })

    req.on('timeout', () => {
      console.log('❌ Native HTTPS: Request timed out')
      req.destroy()
      resolve()
    })

    req.end()
  })
}

async function testWreckBasic() {
  console.log("\nTEST 2: Wreck (Basic) - Application's HTTP client")
  console.log('------------------------------------------------')

  try {
    const { res, payload } = await Wreck.get(OIDC_URL, {
      timeout: 10000
    })

    console.log(`✅ Status: ${res.statusCode}`)
    console.log(`✅ Headers: ${JSON.stringify(res.headers, null, 2)}`)

    try {
      const json = JSON.parse(payload.toString())
      console.log(
        `✅ Response: Valid JSON with ${Object.keys(json).length} keys`
      )
      console.log(`✅ Issuer: ${json.issuer || 'not found'}`)
    } catch (e) {
      console.log(`❌ Response: Invalid JSON - ${e.message}`)
    }
  } catch (error) {
    console.log(`❌ Wreck Error: ${error.message}`)
    console.log(`❌ Error Code: ${error.code || 'none'}`)
    console.log(`❌ Error Name: ${error.name}`)
    if (error.isBoom) {
      console.log(`❌ Boom Error: ${JSON.stringify(error.output)}`)
    }
  }
}

async function testOidcEndpoint() {
  console.log('\nTEST 3: OIDC Endpoint (Wreck) - Exact failing endpoint')
  console.log('----------------------------------------------------')

  try {
    const { res, payload } = await Wreck.get(OIDC_URL)

    if (res.statusCode >= 400) {
      console.log(`❌ HTTP Error: ${res.statusCode} ${res.statusMessage}`)
      return
    }

    const oidcConfig = JSON.parse(payload.toString())
    console.log(`✅ OIDC Config Retrieved Successfully`)
    console.log(`✅ Issuer: ${oidcConfig.issuer}`)
    console.log(
      `✅ Authorization Endpoint: ${oidcConfig.authorization_endpoint}`
    )
    console.log(`✅ Token Endpoint: ${oidcConfig.token_endpoint}`)
    console.log(`✅ End Session Endpoint: ${oidcConfig.end_session_endpoint}`)
  } catch (error) {
    console.log(`❌ OIDC Endpoint Error: ${error.message}`)
    if (error.isBoom) {
      console.log(`❌ Boom Error Details: ${JSON.stringify(error.output)}`)
    }
  }
}

function testEnvironmentCheck() {
  console.log('\nTEST 4: Environment Check')
  console.log('-------------------------')

  const relevantEnvVars = [
    'NODE_ENV',
    'HTTPS_PROXY',
    'HTTP_PROXY',
    'NO_PROXY',
    'DEFRA_ID_OIDC_CONFIGURATION_URL',
    'DEBUG_HTTP_CLIENTS',
    'DEBUG_CONTINUE_ON_ERROR'
  ]

  relevantEnvVars.forEach((varName) => {
    const value = process.env[varName]
    if (value) {
      console.log(`✅ ${varName}: ${value}`)
    } else {
      console.log(`ℹ️  ${varName}: not set`)
    }
  })
}

async function runDiagnostics() {
  try {
    await testNativeHttps()
    await testWreckBasic()
    await testOidcEndpoint()
    testEnvironmentCheck()

    console.log('\n🎯 Diagnostic Complete')
    console.log('======================')
    console.log('If all tests pass locally but fail in deployment:')
    console.log('1. Check network connectivity in deployment environment')
    console.log('2. Verify proxy settings if behind corporate firewall')
    console.log('3. Check certificate trust store in deployment')
    console.log('4. Review deployment logs for additional error details')
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message)
    process.exit(1)
  }
}

runDiagnostics()
