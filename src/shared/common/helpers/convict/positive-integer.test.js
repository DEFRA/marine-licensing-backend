import { convictPositiveInteger } from './positive-integer.js'

describe('convictPositiveInteger', () => {
  it('coerces an environment string to a number', () => {
    expect(convictPositiveInteger.coerce('5000')).toBe(5000)
  })

  it.each([1, 5000])('accepts %s', (value) => {
    expect(() => convictPositiveInteger.validate(value)).not.toThrow()
  })

  it.each([0, -1, 1.5, Number.NaN])('rejects %s', (value) => {
    expect(() => convictPositiveInteger.validate(value)).toThrow(
      'must be a positive integer'
    )
  })
})
