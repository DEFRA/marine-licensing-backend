import { ObjectId } from 'mongodb'
import {
  multipleCoordinatesPostSchema,
  multipleCoordinatesGetParamsSchema
} from './multiple-coordinates.js'
import { COORDINATE_SYSTEMS } from '../common/constants/coordinates.js'

describe('Multiple Coordinates Validation Schema', () => {
  const validExemptionId = new ObjectId().toHexString()

  describe('multipleCoordinatesPostSchema', () => {
    describe('WGS84 Coordinate System', () => {
      const validWGS84Payload = {
        id: validExemptionId,
        coordinateSystem: COORDINATE_SYSTEMS.WGS84,
        coordinates: [
          { latitude: '55.123456', longitude: '-1.234567' },
          { latitude: '55.234567', longitude: '-1.345678' },
          { latitude: '55.345678', longitude: '-1.456789' }
        ]
      }

      it('should validate valid WGS84 coordinates', () => {
        const result = multipleCoordinatesPostSchema.validate(validWGS84Payload)
        expect(result.error).toBeUndefined()
      })

      it('should fail when coordinate system is missing', () => {
        const payload = { ...validWGS84Payload }
        delete payload.coordinateSystem

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('COORDINATE_SYSTEM_REQUIRED')
      })

      it('should fail when coordinate system is invalid', () => {
        const payload = {
          ...validWGS84Payload,
          coordinateSystem: 'INVALID'
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('COORDINATE_SYSTEM_INVALID')
      })

      it('should fail when coordinates array is missing', () => {
        const payload = { ...validWGS84Payload }
        delete payload.coordinates

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('COORDINATES_REQUIRED')
      })

      it('should fail when coordinates array has less than 3 items', () => {
        const payload = {
          ...validWGS84Payload,
          coordinates: [
            { latitude: '55.123456', longitude: '-1.234567' },
            { latitude: '55.234567', longitude: '-1.345678' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain(
          'COORDINATES_MINIMUM_THREE_REQUIRED'
        )
      })

      it('should fail when latitude is missing', () => {
        const payload = {
          ...validWGS84Payload,
          coordinates: [
            { longitude: '-1.234567' },
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('LATITUDE_REQUIRED')
      })

      it('should fail when longitude is missing', () => {
        const payload = {
          ...validWGS84Payload,
          coordinates: [
            { latitude: '55.123456' },
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('LONGITUDE_REQUIRED')
      })

      it('should fail when latitude does not have exactly 6 decimal places', () => {
        const payload = {
          ...validWGS84Payload,
          coordinates: [
            { latitude: '55.12345', longitude: '-1.234567' }, // 5 decimal places
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('LATITUDE_INVALID_FORMAT')
      })

      it('should fail when longitude does not have exactly 6 decimal places', () => {
        const payload = {
          ...validWGS84Payload,
          coordinates: [
            { latitude: '55.123456', longitude: '-1.2345678' }, // 7 decimal places
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('LONGITUDE_INVALID_FORMAT')
      })

      it('should fail when latitude is out of range (below -90)', () => {
        const payload = {
          ...validWGS84Payload,
          coordinates: [
            { latitude: '-90.000001', longitude: '-1.234567' },
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('LATITUDE_OUT_OF_RANGE')
      })

      it('should fail when latitude is out of range (above 90)', () => {
        const payload = {
          ...validWGS84Payload,
          coordinates: [
            { latitude: '90.000001', longitude: '-1.234567' },
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('LATITUDE_OUT_OF_RANGE')
      })

      it('should fail when longitude is out of range (below -180)', () => {
        const payload = {
          ...validWGS84Payload,
          coordinates: [
            { latitude: '55.123456', longitude: '-180.000001' },
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('LONGITUDE_OUT_OF_RANGE')
      })

      it('should fail when longitude is out of range (above 180)', () => {
        const payload = {
          ...validWGS84Payload,
          coordinates: [
            { latitude: '55.123456', longitude: '180.000001' },
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('LONGITUDE_OUT_OF_RANGE')
      })

      it('should accept boundary values for latitude (-90 and 90)', () => {
        const payload = {
          ...validWGS84Payload,
          coordinates: [
            { latitude: '-90.000000', longitude: '-1.234567' },
            { latitude: '90.000000', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error).toBeUndefined()
      })

      it('should accept boundary values for longitude (-180 and 180)', () => {
        const payload = {
          ...validWGS84Payload,
          coordinates: [
            { latitude: '55.123456', longitude: '-180.000000' },
            { latitude: '55.234567', longitude: '180.000000' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error).toBeUndefined()
      })
    })

    describe('OSGB36 Coordinate System', () => {
      const validOSGB36Payload = {
        id: validExemptionId,
        coordinateSystem: COORDINATE_SYSTEMS.OSGB36,
        coordinates: [
          { eastings: '425053', northings: '564180' },
          { eastings: '426053', northings: '565180' },
          { eastings: '427053', northings: '566180' }
        ]
      }

      it('should validate valid OSGB36 coordinates', () => {
        const result =
          multipleCoordinatesPostSchema.validate(validOSGB36Payload)
        expect(result.error).toBeUndefined()
      })

      it('should fail when eastings is missing', () => {
        const payload = {
          ...validOSGB36Payload,
          coordinates: [
            { northings: '564180' },
            { eastings: '426053', northings: '565180' },
            { eastings: '427053', northings: '566180' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('EASTINGS_REQUIRED')
      })

      it('should fail when northings is missing', () => {
        const payload = {
          ...validOSGB36Payload,
          coordinates: [
            { eastings: '425053' },
            { eastings: '426053', northings: '565180' },
            { eastings: '427053', northings: '566180' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('NORTHINGS_REQUIRED')
      })

      it('should fail when eastings is not exactly 6 digits', () => {
        const payload = {
          ...validOSGB36Payload,
          coordinates: [
            { eastings: '42505', northings: '564180' }, // 5 digits
            { eastings: '426053', northings: '565180' },
            { eastings: '427053', northings: '566180' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('EASTINGS_INVALID_FORMAT')
      })

      it('should fail when northings is not 6 or 7 digits', () => {
        const payload = {
          ...validOSGB36Payload,
          coordinates: [
            { eastings: '425053', northings: '56418' }, // 5 digits
            { eastings: '426053', northings: '565180' },
            { eastings: '427053', northings: '566180' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('NORTHINGS_INVALID_FORMAT')
      })

      it('should accept 7-digit northings', () => {
        const payload = {
          ...validOSGB36Payload,
          coordinates: [
            { eastings: '425053', northings: '5641800' }, // 7 digits
            { eastings: '426053', northings: '565180' },
            { eastings: '427053', northings: '566180' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error).toBeUndefined()
      })

      it('should fail when eastings is out of range (below 100000)', () => {
        const payload = {
          ...validOSGB36Payload,
          coordinates: [
            { eastings: '099999', northings: '564180' },
            { eastings: '426053', northings: '565180' },
            { eastings: '427053', northings: '566180' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('EASTINGS_OUT_OF_RANGE')
      })

      it('should fail when eastings is out of range (above 999999)', () => {
        const payload = {
          ...validOSGB36Payload,
          coordinates: [
            { eastings: '1000000', northings: '564180' }, // Too many digits anyway
            { eastings: '426053', northings: '565180' },
            { eastings: '427053', northings: '566180' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('EASTINGS_INVALID_FORMAT')
      })

      it('should fail when northings is out of range (below 100000)', () => {
        const payload = {
          ...validOSGB36Payload,
          coordinates: [
            { eastings: '425053', northings: '099999' },
            { eastings: '426053', northings: '565180' },
            { eastings: '427053', northings: '566180' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('NORTHINGS_OUT_OF_RANGE')
      })

      it('should accept boundary values for eastings (100000 and 999999)', () => {
        const payload = {
          ...validOSGB36Payload,
          coordinates: [
            { eastings: '100000', northings: '564180' },
            { eastings: '999999', northings: '565180' },
            { eastings: '427053', northings: '566180' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error).toBeUndefined()
      })

      it('should accept boundary values for northings (100000 and 9999999)', () => {
        const payload = {
          ...validOSGB36Payload,
          coordinates: [
            { eastings: '425053', northings: '100000' },
            { eastings: '426053', northings: '9999999' },
            { eastings: '427053', northings: '566180' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error).toBeUndefined()
      })
    })

    describe('Exemption ID Validation', () => {
      it('should fail when exemption ID is missing', () => {
        const payload = {
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: [
            { latitude: '55.123456', longitude: '-1.234567' },
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('EXEMPTION_ID_REQUIRED')
      })

      it('should fail when exemption ID is invalid format', () => {
        const payload = {
          id: 'invalid-id',
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: [
            { latitude: '55.123456', longitude: '-1.234567' },
            { latitude: '55.234567', longitude: '-1.345678' },
            { latitude: '55.345678', longitude: '-1.456789' }
          ]
        }

        const result = multipleCoordinatesPostSchema.validate(payload)
        expect(result.error.message).toContain('EXEMPTION_ID_REQUIRED')
      })
    })
  })

  describe('multipleCoordinatesGetParamsSchema', () => {
    it('should validate valid exemption ID', () => {
      const params = { exemptionId: validExemptionId }
      const result = multipleCoordinatesGetParamsSchema.validate(params)
      expect(result.error).toBeUndefined()
    })

    it('should fail when exemption ID is missing', () => {
      const params = {}
      const result = multipleCoordinatesGetParamsSchema.validate(params)
      expect(result.error.message).toContain('EXEMPTION_ID_REQUIRED')
    })

    it('should fail when exemption ID is invalid format', () => {
      const params = { exemptionId: 'invalid-id' }
      const result = multipleCoordinatesGetParamsSchema.validate(params)
      expect(result.error.message).toContain('EXEMPTION_ID_REQUIRED')
    })

    it('should fail when exemption ID is wrong length', () => {
      const params = { exemptionId: '123' }
      const result = multipleCoordinatesGetParamsSchema.validate(params)
      expect(result.error.message).toContain('EXEMPTION_ID_REQUIRED')
    })

    it('should fail when exemption ID contains non-hex characters', () => {
      const params = { exemptionId: validExemptionId.replace('a', 'z') }
      const result = multipleCoordinatesGetParamsSchema.validate(params)
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('EXEMPTION_ID_INVALID')
    })
  })
})
