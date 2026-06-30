import { feeEstimateSchema } from './fee-estimate.js'
import { mockMarineLicence } from './test-fixtures.js'

describe('feeEstimateSchema', () => {
  const validPayload = {
    accept: 'yes',
    termsAndConditions: true,
    id: mockMarineLicence._id.toHexString()
  }

  test('should pass with valid data', () => {
    const { error } = feeEstimateSchema.validate(validPayload)
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
