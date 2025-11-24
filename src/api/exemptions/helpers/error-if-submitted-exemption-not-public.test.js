import { vi } from 'vitest'
import { errorIfSubmittedExemptionNotPublic } from './error-if-submitted-exemption-not-public.js'
import Boom from '@hapi/boom'

describe('errorIfSubmittedExemptionNotPublic', () => {
  it('should throw 403 when publicRegister consent is no', () => {
    const exemption = { status: 'ACTIVE', publicRegister: { consent: 'no' } }
    const boomSpy = vi.spyOn(Boom, 'forbidden')

    expect(() => errorIfSubmittedExemptionNotPublic(exemption)).toThrow()

    expect(boomSpy).toHaveBeenCalledWith(
      'Not authorized to request this resource'
    )
  })

  it('should throw 403 when status is not ACTIVE', () => {
    const exemption = { status: 'DRAFT', publicRegister: { consent: 'yes' } }
    const boomSpy = vi.spyOn(Boom, 'forbidden')

    expect(() => errorIfSubmittedExemptionNotPublic(exemption)).toThrow()

    expect(boomSpy).toHaveBeenCalledWith(
      'Not authorized to request this resource'
    )
  })

  it('should not throw when publicRegister consent is yes', () => {
    const exemption = { status: 'ACTIVE', publicRegister: { consent: 'yes' } }

    expect(() => errorIfSubmittedExemptionNotPublic(exemption)).not.toThrow()
  })

  it('should not throw when publicRegister is undefined', () => {
    const exemption = { status: 'ACTIVE' }

    expect(() => errorIfSubmittedExemptionNotPublic(exemption)).not.toThrow()
  })

  it('should not throw when publicRegister.consent is undefined', () => {
    const exemption = { status: 'ACTIVE', publicRegister: {} }

    expect(() => errorIfSubmittedExemptionNotPublic(exemption)).not.toThrow()
  })
})
