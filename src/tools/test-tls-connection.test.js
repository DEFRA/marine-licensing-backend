import tls from 'node:tls'
import { isTlsError, createTlsContext } from './test-tls-connection.js'
import { getTrustStoreCerts } from '../common/helpers/secure-context/get-trust-store-certs.js'

jest.mock('../common/helpers/secure-context/get-trust-store-certs.js', () => ({
  getTrustStoreCerts: jest.fn()
}))
describe('test-tls-connection.js', () => {
  describe('isTlsError()', () => {
    it('returns false for null/undefined', () => {
      expect(isTlsError(null)).toBe(false)
      expect(isTlsError(undefined)).toBe(false)
    })

    it('returns true for known TLS error codes', () => {
      const codes = [
        'ECONNRESET',
        'CERT_HAS_EXPIRED',
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        'DEPTH_ZERO_SELF_SIGNED_CERT',
        'ERR_TLS_CERT_ALTNAME_INVALID',
        'CERT_SIGNATURE_FAILURE'
      ]
      for (const code of codes) {
        expect(isTlsError({ code })).toBe(true)
      }
    })

    it('returns true for messages containing tls/certificate/ssl keywords', () => {
      expect(isTlsError({ message: 'TLS handshake failed' })).toBe(true)
      expect(isTlsError({ message: 'certificate verification error' })).toBe(
        true
      )
      expect(isTlsError({ message: 'some ssl problem' })).toBe(true)
      expect(isTlsError({ message: 'self signed cert not trusted' })).toBe(true)
    })

    it('returns false for unrelated errors', () => {
      expect(isTlsError({ code: 'ECONNREFUSED', message: 'refused' })).toBe(
        false
      )
      expect(isTlsError({ message: 'network timeout' })).toBe(false)
    })
  })

  describe('createTlsContext()', () => {
    let originalConsoleLog
    let originalConsoleError

    beforeEach(() => {
      originalConsoleLog = console.log
      originalConsoleError = console.error
      console.log = jest.fn()
      console.error = jest.fn()
    })

    afterEach(() => {
      console.log = originalConsoleLog
      console.error = originalConsoleError
      jest.resetAllMocks()
    })

    it('creates a TLS context and adds all certificates', () => {
      const fakeCerts = ['CERT1', 'CERT2', 'CERT3']
      getTrustStoreCerts.mockReturnValueOnce(fakeCerts)

      const fakeSecureContext = {
        context: { addCACert: jest.fn() }
      }
      jest
        .spyOn(tls, 'createSecureContext')
        .mockReturnValueOnce(fakeSecureContext)

      const ctx = createTlsContext()

      expect(ctx).toBe(fakeSecureContext)

      expect(console.log).toHaveBeenCalledWith(
        `Found ${fakeCerts.length} certificates in environment variables`
      )
      expect(tls.createSecureContext).toHaveBeenCalledWith({})

      fakeCerts.forEach((cert, idx) => {
        expect(console.log).toHaveBeenCalledWith(
          `Adding certificate #${idx + 1} to TLS context`
        )
        expect(fakeSecureContext.context.addCACert).toHaveBeenCalledWith(cert)
      })

      expect(console.log).toHaveBeenCalledWith(
        'TLS context created successfully'
      )
      expect(console.error).not.toHaveBeenCalled()
    })

    it('continues if adding one cert throws', () => {
      const fakeCerts = ['GOOD', 'BAD', 'GOOD2']
      getTrustStoreCerts.mockReturnValueOnce(fakeCerts)

      const fakeSecureContext = {
        context: {
          addCACert: jest.fn((c) => {
            if (c === 'BAD') throw new Error('malformed')
          })
        }
      }
      jest
        .spyOn(tls, 'createSecureContext')
        .mockReturnValueOnce(fakeSecureContext)

      const ctx = createTlsContext()

      expect(ctx).toBe(fakeSecureContext)
      expect(console.error).toHaveBeenCalledWith(
        `Failed to add certificate #2: malformed`
      )
      expect(console.log).toHaveBeenCalledWith(
        'TLS context created successfully'
      )
    })

    it('returns null and logs error if getTrustStoreCerts throws', () => {
      getTrustStoreCerts.mockImplementationOnce(() => {
        throw new Error('no env')
      })
      const result = createTlsContext()
      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith(
        `Failed to create TLS context: no env`
      )
    })
  })
})
