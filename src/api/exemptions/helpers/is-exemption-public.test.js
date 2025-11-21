import { vi } from 'vitest'
import { isExemptionPublic } from './is-exemption-public.js'
import Boom from '@hapi/boom'

describe('isExemptionPublic', () => {
  it('should throw 403 when publicRegister consent is no', () => {
    const exemption = { publicRegister: { consent: 'no' } }
    const boomSpy = vi.spyOn(Boom, 'forbidden')

    expect(() => isExemptionPublic(exemption)).toThrow()

    expect(boomSpy).toHaveBeenCalledWith(
      'Not authorized to request this resource'
    )
  })

  it('should not throw when publicRegister consent is yes', () => {
    const exemption = { publicRegister: { consent: 'yes' } }

    expect(() => isExemptionPublic(exemption)).not.toThrow()
  })

  it('should not throw when publicRegister is undefined', () => {
    const exemption = {}

    expect(() => isExemptionPublic(exemption)).not.toThrow()
  })

  it('should not throw when publicRegister.consent is undefined', () => {
    const exemption = { publicRegister: {} }

    expect(() => isExemptionPublic(exemption)).not.toThrow()
  })
})
