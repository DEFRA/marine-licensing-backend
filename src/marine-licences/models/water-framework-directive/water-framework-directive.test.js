import { waterFrameworkDirectiveSchema } from './water-framework-directive.js'
import { mockWaterFrameworkDirective } from '../../../../tests/test.fixture.js'

describe('waterFrameworkDirective', () => {
  const validId = 'a'.repeat(24)

  describe('waterFrameworkDirective object', () => {
    test('should fail if waterFrameworkDirective object is missing', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({ id: validId })
      expect(error.message).toContain('WATER_FRAMEWORK_DIRECTIVE_REQUIRED')
    })
  })

  describe('nauticalMile', () => {
    test('should pass with yes', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {
          ...mockWaterFrameworkDirective,
          nauticalMile: 'yes'
        }
      })
      expect(error).toBeUndefined()
    })

    test('should pass with no', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: { nauticalMile: 'no' }
      })
      expect(error).toBeUndefined()
    })

    test('should fail if missing', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {}
      })
      expect(error.message).toContain('NAUTICAL_MILE_REQUIRED')
    })

    test('should fail if not a valid value', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: { nauticalMile: 'maybe' }
      })
      expect(error.message).toContain('NAUTICAL_MILE_REQUIRED')
    })

    test('should fail if empty string', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: { nauticalMile: '' }
      })
      expect(error.message).toContain('NAUTICAL_MILE_REQUIRED')
    })
  })

  describe('nauticalMile yes', () => {
    test('should pass with yes and valid data', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {
          ...mockWaterFrameworkDirective,
          nauticalMile: 'yes'
        }
      })
      expect(error).toBeUndefined()
    })

    test('should fail if missing excludedActivities', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {
          nauticalMile: 'yes',
          assessmentChanged: 'yes',
          previousAssessment: 'yes'
        }
      })
      expect(error.message).toContain('EXCLUDED_ACTIVITIES_REQUIRED')
    })

    test('should fail if not a valid value for excludedActivities', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {
          ...mockWaterFrameworkDirective,
          nauticalMile: 'yes',
          excludedActivities: 'maybe'
        }
      })
      expect(error.message).toContain('EXCLUDED_ACTIVITIES_REQUIRED')
    })

    test('should fail if empty string for excludedActivities', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {
          ...mockWaterFrameworkDirective,
          nauticalMile: 'yes',
          excludedActivities: ''
        }
      })
      expect(error.message).toContain('EXCLUDED_ACTIVITIES_REQUIRED')
    })

    test('should fail if missing previousAssessment', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {
          nauticalMile: 'yes',
          assessmentChanged: 'yes',
          excludedActivities: 'yes'
        }
      })
      expect(error.message).toContain('PREVIOUS_ASSESSMENT_REQUIRED')
    })

    test('should fail if not a valid value for previousAssessment', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {
          nauticalMile: 'yes',
          assessmentChanged: 'yes',
          excludedActivities: 'yes',
          previousAssessment: 'maybe'
        }
      })
      expect(error.message).toContain('PREVIOUS_ASSESSMENT_REQUIRED')
    })

    test('should fail if empty string for previousAssessment', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {
          ...mockWaterFrameworkDirective,
          previousAssessment: ''
        }
      })
      expect(error.message).toContain('PREVIOUS_ASSESSMENT_REQUIRED')
    })

    test('should fail if missing assessmentChanged', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {
          nauticalMile: 'yes',
          excludedActivities: 'yes',
          previousAssessment: 'yes'
        }
      })
      expect(error.message).toContain('ASSESSMENT_CHANGED_REQUIRED')
    })

    test('should fail if not a valid value for assessmentChanged', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {
          ...mockWaterFrameworkDirective,
          nauticalMile: 'yes',
          assessmentChanged: 'maybe'
        }
      })
      expect(error.message).toContain('ASSESSMENT_CHANGED_REQUIRED')
    })

    test('should fail if empty string for assessmentChanged', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {
          ...mockWaterFrameworkDirective,
          nauticalMile: 'yes',
          assessmentChanged: ''
        }
      })
      expect(error.message).toContain('ASSESSMENT_CHANGED_REQUIRED')
    })

    test('should fail if empty for file upload or s3 data', () => {
      const { error: fileError } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {
          ...mockWaterFrameworkDirective,
          nauticalMile: 'yes',
          uploadedFile: ''
        }
      })
      expect(fileError.message).toContain('UPLOADED_FILE_INVALID')

      const { error: s3Error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {
          ...mockWaterFrameworkDirective,
          nauticalMile: 'yes',
          s3Location: ''
        }
      })
      expect(s3Error.message).toContain('S3_LOCATION_INVALID')
    })

    test('should fail if invalid value for file upload', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {
          ...mockWaterFrameworkDirective,
          nauticalMile: 'yes',
          uploadedFile: { invalidValue: 'test' }
        }
      })
      expect(error.message).toContain('UPLOADED_FILE_FILENAME_REQUIRED')
    })

    test('should fail if invalid value for s3', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {
          ...mockWaterFrameworkDirective,
          nauticalMile: 'yes',
          s3Location: { invalidValue: 'test' }
        }
      })
      expect(error.message).toContain('S3_BUCKET_REQUIRED')
    })
  })

  describe('nauticalMile no', () => {
    test('should fail if provided', () => {
      const { error } = waterFrameworkDirectiveSchema.validate({
        id: validId,
        waterFrameworkDirective: {
          nauticalMile: 'no',
          excludedActivities: 'yes',
          previousAssessment: 'yes'
        }
      })
      expect(error.message).toContain('WATER_FRAMEWORK_DIRECTIVE_INVALID')
    })
  })
})
