const TLS_ERROR_CODES = [
  'ECONNRESET',
  'CERT_HAS_EXPIRED',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'CERT_SIGNATURE_FAILURE'
]

export function isTlsError(error) {
  if (!error) {
    return false
  }

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
