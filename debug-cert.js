// This is a debugging script to verify certificate loading
import { getTrustStoreCerts } from './src/common/helpers/secure-context/get-trust-store-certs.js'

const certs = getTrustStoreCerts(process.env)

console.log(
  `Found ${certs.length} certificates in TRUSTSTORE environment variables`
)

if (certs.length > 0) {
  certs.forEach((cert, index) => {
    console.log(`\nCertificate #${index + 1}:`)
    console.log(cert.substring(0, 100) + '...') // Show just the beginning to verify format

    if (!cert.includes('-----BEGIN CERTIFICATE-----')) {
      console.error(
        'WARNING: Certificate does not contain the expected BEGIN CERTIFICATE marker'
      )
    }

    if (!cert.includes('-----END CERTIFICATE-----')) {
      console.error(
        'WARNING: Certificate does not contain the expected END CERTIFICATE marker'
      )
    }
  })
} else {
  console.log(
    'No certificates found. Check your TRUSTSTORE_* environment variables'
  )
}

// Check proxy settings
console.log('\nProxy settings:')
console.log(`HTTP_PROXY: ${process.env.HTTP_PROXY || '(not set)'}`)
console.log(`HTTPS_PROXY: ${process.env.HTTPS_PROXY || '(not set)'}`)
console.log(`NO_PROXY: ${process.env.NO_PROXY || '(not set)'}`)

// Check secure context setting
console.log('\nSecure context settings:')
console.log(
  `ENABLE_SECURE_CONTEXT: ${process.env.ENABLE_SECURE_CONTEXT || '(not set)'}`
)
