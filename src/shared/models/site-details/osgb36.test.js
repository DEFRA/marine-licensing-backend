import { vi } from 'vitest'
import { COORDINATE_SYSTEMS } from '../../../shared/common/constants/coordinates.js'
import { osgb36ValidationSchema } from './osgb36.js'

const mockCoordinates = {
  [COORDINATE_SYSTEMS.OSGB36]: { easting: '425053', northing: '564180' }
}

describe('#osgb36ValidationSchema model', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('Should correctly validate on valid data', () => {
    const request = mockCoordinates[COORDINATE_SYSTEMS.OSGB36]

    const result = osgb36ValidationSchema.validate(request)

    expect(result.error).toBeUndefined()
  })

  test('Should pass validation on minimum values', () => {
    const result = osgb36ValidationSchema.validate({
      easting: '0',
      northing: '0'
    })

    expect(result.error).toBeUndefined()
  })

  test('Should pass validation on maximum values', () => {
    const result = osgb36ValidationSchema.validate({
      easting: '999999',
      northing: '9999999'
    })

    expect(result.error).toBeUndefined()
  })

  test('Should correctly validate on empty data', () => {
    const request = {}

    const result = osgb36ValidationSchema.validate(request, {
      abortEarly: false
    })

    expect(result.error.message).toContain('EASTING_REQUIRED')
    expect(result.error.message).toContain('NORTHING_REQUIRED')
  })

  test('Should correctly validate when easting is an empty string', () => {
    const request = {
      easting: '',
      northing: '564180'
    }

    const result = osgb36ValidationSchema.validate(request, {
      abortEarly: false
    })

    expect(result.error.message).toContain('EASTING_REQUIRED')
    expect(result.error.message).not.toContain('NORTHING_REQUIRED')
  })

  test('Should correctly validate when northing is an empty string', () => {
    const request = {
      easting: '425053',
      northing: ''
    }

    const result = osgb36ValidationSchema.validate(request, {
      abortEarly: false
    })

    expect(result.error.message).not.toContain('EASTING_REQUIRED')
    expect(result.error.message).toContain('NORTHING_REQUIRED')
  })

  test('Should correctly validate when northing and easting is above maximum allowed value', () => {
    const request = {
      easting: '1000000',
      northing: '10000000'
    }

    const result = osgb36ValidationSchema.validate(request, {
      abortEarly: false
    })

    expect(result.error.message).toContain('EASTING_LENGTH')
    expect(result.error.message).toContain('NORTHING_LENGTH')
  })

  test('Should correctly validate when easting and northing are negative numbers', () => {
    const request = {
      easting: '-425053',
      northing: '-564180'
    }

    const result = osgb36ValidationSchema.validate(request, {
      abortEarly: false
    })

    expect(result.error.message).toContain('EASTING_POSITIVE_NUMBER')
    expect(result.error.message).toContain('NORTHING_POSITIVE_NUMBER')
  })

  test('Should correctly validate when easting and northing contain incorrect characters', () => {
    const request = {
      easting: '42505/',
      northing: '56410/'
    }

    const result = osgb36ValidationSchema.validate(request, {
      abortEarly: false
    })

    expect(result.error.message).toContain('EASTING_NON_NUMERIC')
    expect(result.error.message).toContain('NORTHING_NON_NUMERIC')
  })

  test('Should correctly validate when easting and northing contain - inside the value', () => {
    const request = {
      easting: '425-057',
      northing: '564-109'
    }

    const result = osgb36ValidationSchema.validate(request, {
      abortEarly: false
    })

    expect(result.error.message).toContain('EASTING_NON_NUMERIC')
    expect(result.error.message).toContain('NORTHING_NON_NUMERIC')
  })
})
