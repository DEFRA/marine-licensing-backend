import { isTlsError } from './tls-error.js'

describe('tls-error', () => {
  describe('isTlsError()', () => {
    it('returns false for null/undefined error', () => {
      expect(isTlsError(null)).toBe(false)
      expect(isTlsError(undefined)).toBe(false)
    })

    it('identifies TLS errors by code', () => {
      const tlsErrorCodes = [
        'ECONNRESET',
        'CERT_HAS_EXPIRED',
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        'DEPTH_ZERO_SELF_SIGNED_CERT',
        'ERR_TLS_CERT_ALTNAME_INVALID',
        'CERT_SIGNATURE_FAILURE'
      ]

      tlsErrorCodes.forEach((code) => {
        const error = new Error('TLS Error')
        error.code = code
        expect(isTlsError(error)).toBe(true)
      })

      const nonTlsError = new Error('Some other error')
      nonTlsError.code = 'ENOENT'
      expect(isTlsError(nonTlsError)).toBe(false)
    })

    it('identifies TLS errors by message content', () => {
      const tlsKeywords = [
        'tls',
        'certificate',
        'ssl',
        'handshake',
        'self signed',
        'verification'
      ]

      tlsKeywords.forEach((keyword) => {
        const error = new Error(`Error with ${keyword} problem`)
        expect(isTlsError(error)).toBe(true)
      })

      const errorUppercase = new Error('TLS CERTIFICATE PROBLEM')
      expect(isTlsError(errorUppercase)).toBe(true)
      const nonTlsError = new Error('Some other error')
      expect(isTlsError(nonTlsError)).toBe(false)
    })

    it('handles errors without message property', () => {
      const error = { name: 'Error', stack: 'Error stack' }
      expect(isTlsError(error)).toBe(false)
    })

    it('handles errors with code but no message', () => {
      const error = { code: 'ECONNRESET' }
      expect(isTlsError(error)).toBe(true)
    })
  })
})
