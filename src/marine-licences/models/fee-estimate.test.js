import { feeEstimateSchema } from './fee-estimate.js'
import { mockMarineLicence } from './test-fixtures.js'

describe('feeEstimateSchema', () => {
  const validPayload = {
    accept: 'yes',
    feeBand: '2A',
    termsAndConditions: true,
    id: mockMarineLicence._id.toHexString()
  }

  test('should pass with valid data', () => {
    const { error } = feeEstimateSchema.validate(validPayload)
    expect(error).toBeUndefined()
  })

  test('should error when feeBand is missing and accept is yes', () => {
    const { error } = feeEstimateSchema.validate({
      ...validPayload,
      feeBand: undefined
    })
    expect(error.message).toContain('FEE_ESTIMATE_FEE_BAND_REQUIRED')
  })

  test('should pass when feeBand is missing and accept is no', () => {
    const { error } = feeEstimateSchema.validate({
      accept: 'no',
      termsAndConditions: true,
      id: mockMarineLicence._id.toHexString()
    })
    expect(error).toBeUndefined()
  })

  test('should pass when feeBand is provided and accept is no', () => {
    const { error } = feeEstimateSchema.validate({
      accept: 'no',
      feeBand: 'Band B',
      termsAndConditions: true,
      id: mockMarineLicence._id.toHexString()
    })
    expect(error).toBeUndefined()
  })

  test('should error when accept is missing', () => {
    const { error } = feeEstimateSchema.validate({
      termsAndConditions: true,
      id: mockMarineLicence._id.toHexString()
    })
    expect(error.message).toContain('FEE_ESTIMATE_ACCEPT_REQUIRED')
  })

  test('should error when accept is invalid', () => {
    const { error } = feeEstimateSchema.validate({
      ...validPayload,
      accept: 'incorrect'
    })
    expect(error.message).toContain('FEE_ESTIMATE_ACCEPT_REQUIRED')
  })

  test('should error when termsAndConditions is missing', () => {
    const { error } = feeEstimateSchema.validate({
      accept: 'yes',
      feeBand: '2A',
      id: mockMarineLicence._id.toHexString()
    })
    expect(error.message).toContain(
      'FEE_ESTIMATE_TERMS_AND_CONDITIONS_REQUIRED'
    )
  })

  test('should error when termsAndConditions is invalid', () => {
    const { error } = feeEstimateSchema.validate({
      ...validPayload,
      termsAndConditions: 'incorrect'
    })
    expect(error.message).toContain(
      'FEE_ESTIMATE_TERMS_AND_CONDITIONS_REQUIRED'
    )
  })
})
