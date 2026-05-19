import { vi } from 'vitest'
import { MIN_POINTS_MULTIPLE_COORDINATES } from '../../../shared/common/constants/coordinates.js'
import {
  osgb36MultipleCoordinatesSchema,
  osgb36MultipleItemSchema
} from './osgb36.js'

const validCoordinate = { easting: '425053', northing: '564180' }

const validMultipleCoordinates = Array.from(
  { length: MIN_POINTS_MULTIPLE_COORDINATES },
  (_, index) => ({
    easting: String(425053 + index),
    northing: String(564180 + index)
  })
)

describe('#osgb36MultipleItemSchema model', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('Should correctly validate on valid data', () => {
    const result = osgb36MultipleItemSchema.validate(validCoordinate)

    expect(result.error).toBeUndefined()
  })

  test('Should pass validation on minimum values', () => {
    const result = osgb36MultipleItemSchema.validate({
      easting: '0',
      northing: '0'
    })

    expect(result.error).toBeUndefined()
  })

  test('Should pass validation on maximum values', () => {
    const result = osgb36MultipleItemSchema.validate({
      easting: '999999',
      northing: '9999999'
    })

    expect(result.error).toBeUndefined()
  })

  test('Should correctly validate on empty data', () => {
    const result = osgb36MultipleItemSchema.validate({}, { abortEarly: false })

    expect(result.error.message).toContain('EASTING_REQUIRED')
    expect(result.error.message).toContain('NORTHING_REQUIRED')
  })

  test('Should correctly validate when easting is an empty string', () => {
    const result = osgb36MultipleItemSchema.validate(
      { easting: '', northing: '564180' },
      { abortEarly: false }
    )

    expect(result.error.message).toContain('EASTING_REQUIRED')
    expect(result.error.message).not.toContain('NORTHING_REQUIRED')
  })

  test('Should correctly validate when northing is an empty string', () => {
    const result = osgb36MultipleItemSchema.validate(
      { easting: '425053', northing: '' },
      { abortEarly: false }
    )

    expect(result.error.message).not.toContain('EASTING_REQUIRED')
    expect(result.error.message).toContain('NORTHING_REQUIRED')
  })

  test('Should correctly validate when northing and easting is above maximum allowed value', () => {
    const result = osgb36MultipleItemSchema.validate(
      { easting: '1000000', northing: '10000000' },
      { abortEarly: false }
    )

    expect(result.error.message).toContain('EASTING_LENGTH')
    expect(result.error.message).toContain('NORTHING_LENGTH')
  })

  test('Should correctly validate when easting and northing are negative numbers', () => {
    const result = osgb36MultipleItemSchema.validate(
      { easting: '-425053', northing: '-564180' },
      { abortEarly: false }
    )

    expect(result.error.message).toContain('EASTING_POSITIVE_NUMBER')
    expect(result.error.message).toContain('NORTHING_POSITIVE_NUMBER')
  })

  test('Should correctly validate when easting and northing contain incorrect characters', () => {
    const result = osgb36MultipleItemSchema.validate(
      { easting: '42505/', northing: '56410/' },
      { abortEarly: false }
    )

    expect(result.error.message).toContain('EASTING_NON_NUMERIC')
    expect(result.error.message).toContain('NORTHING_NON_NUMERIC')
  })

  test('Should correctly validate when easting and northing contain - inside the value', () => {
    const result = osgb36MultipleItemSchema.validate(
      { easting: '425-057', northing: '564-109' },
      { abortEarly: false }
    )

    expect(result.error.message).toContain('EASTING_NON_NUMERIC')
    expect(result.error.message).toContain('NORTHING_NON_NUMERIC')
  })

  test('Should return EASTING_NON_NUMERIC when easting is not a number', () => {
    const result = osgb36MultipleItemSchema.validate(
      { easting: '.', northing: '564180' },
      { abortEarly: false }
    )

    expect(result.error.message).toContain('EASTING_NON_NUMERIC')
  })

  test('Should return NORTHING_NON_NUMERIC when northing is not a number', () => {
    const result = osgb36MultipleItemSchema.validate(
      { easting: '425053', northing: '.' },
      { abortEarly: false }
    )

    expect(result.error.message).toContain('NORTHING_NON_NUMERIC')
  })
})

describe('#osgb36MultipleCoordinatesSchema model', () => {
  test('Should correctly validate on valid data', () => {
    const result = osgb36MultipleCoordinatesSchema.validate(
      validMultipleCoordinates
    )

    expect(result.error).toBeUndefined()
  })

  test('Should fail when fewer than minimum coordinates are provided', () => {
    const result = osgb36MultipleCoordinatesSchema.validate(
      validMultipleCoordinates.slice(0, MIN_POINTS_MULTIPLE_COORDINATES - 1),
      { abortEarly: false }
    )

    expect(result.error.message).toContain('COORDINATES_MINIMUM_REQUIRED')
  })

  test('Should fail when more than maximum coordinates are provided', () => {
    const result = osgb36MultipleCoordinatesSchema.validate(
      Array.from({ length: 1001 }, () => validCoordinate),
      { abortEarly: false }
    )

    expect(result.error.message).toContain('COORDINATES_MAXIMUM_EXCEEDED')
  })

  test('Should fail when coordinates is not an array', () => {
    const result = osgb36MultipleCoordinatesSchema.validate(validCoordinate, {
      abortEarly: false
    })

    expect(result.error.message).toContain('COORDINATES_ARRAY_REQUIRED')
  })

  test('Should fail when coordinates are required but missing', () => {
    const result = osgb36MultipleCoordinatesSchema.validate(undefined, {
      abortEarly: false
    })

    expect(result.error.message).toContain('COORDINATES_REQUIRED')
  })
})
