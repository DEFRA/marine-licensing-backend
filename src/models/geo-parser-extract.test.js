import { geoParserExtract } from './geo-parser-extract.js'

describe('geoParserExtract validation schema', () => {
  describe('s3Bucket validation', () => {
    it('should validate valid s3Bucket', () => {
      const payload = {
        s3Bucket: 'mmo-uploads',
        s3Key: 'test.kml',
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeUndefined()
      expect(result.value.s3Bucket).toBe('mmo-uploads')
    })

    it('should reject missing s3Bucket', () => {
      const payload = {
        s3Key: 'test.kml',
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeDefined()
      expect(result.error.details[0].message).toBe('S3_BUCKET_REQUIRED')
    })

    it('should reject empty s3Bucket', () => {
      const payload = {
        s3Bucket: '',
        s3Key: 'test.kml',
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeDefined()
      expect(result.error.details[0].message).toBe('S3_BUCKET_REQUIRED')
    })

    it('should reject null s3Bucket', () => {
      const payload = {
        s3Bucket: null,
        s3Key: 'test.kml',
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeDefined()
      expect(result.error.details[0].message).toBe(
        '"s3Bucket" must be a string'
      )
    })

    it('should handle s3Bucket with special characters', () => {
      const payload = {
        s3Bucket: 'mmo-uploads-test',
        s3Key: 'test.kml',
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeUndefined()
      expect(result.value.s3Bucket).toBe('mmo-uploads-test')
    })

    it('should handle s3Bucket with numbers', () => {
      const payload = {
        s3Bucket: 'mmo-uploads-123',
        s3Key: 'test.kml',
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeUndefined()
      expect(result.value.s3Bucket).toBe('mmo-uploads-123')
    })
  })

  describe('s3Key validation', () => {
    it('should validate valid s3Key', () => {
      const payload = {
        s3Bucket: 'mmo-uploads',
        s3Key: 'folder/test-file.kml',
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeUndefined()
      expect(result.value.s3Key).toBe('folder/test-file.kml')
    })

    it('should reject missing s3Key', () => {
      const payload = {
        s3Bucket: 'mmo-uploads',
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeDefined()
      expect(result.error.details[0].message).toBe('S3_KEY_REQUIRED')
    })

    it('should reject empty s3Key', () => {
      const payload = {
        s3Bucket: 'mmo-uploads',
        s3Key: '',
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeDefined()
      expect(result.error.details[0].message).toBe('S3_KEY_REQUIRED')
    })

    it('should reject s3Key that is too long', () => {
      const longKey = 'a'.repeat(1025)
      const payload = {
        s3Bucket: 'mmo-uploads',
        s3Key: longKey,
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeDefined()
      expect(result.error.details[0].message).toBe('S3_KEY_INVALID')
    })

    it('should accept s3Key at maximum length', () => {
      const maxKey = 'a'.repeat(1024)
      const payload = {
        s3Bucket: 'mmo-uploads',
        s3Key: maxKey,
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeUndefined()
      expect(result.value.s3Key).toBe(maxKey)
    })

    it('should accept s3Key with valid characters', () => {
      const validKeys = [
        'simple-file.kml',
        'folder/subfolder/file.kml',
        'file_with_underscores.kml',
        'file.with.dots.kml',
        'file123.kml',
        'UPPERCASE.KML',
        'file-name_with.various/characters123.kml'
      ]

      for (const s3Key of validKeys) {
        const payload = {
          s3Bucket: 'mmo-uploads',
          s3Key,
          fileType: 'kml'
        }

        const result = geoParserExtract.validate(payload)

        expect(result.error).toBeUndefined()
        expect(result.value.s3Key).toBe(s3Key)
      }
    })

    it('should reject s3Key with invalid characters', () => {
      const invalidKeys = [
        'file<name>.kml',
        'file>name.kml',
        'file|name.kml',
        'file:name.kml',
        'file"name.kml',
        'file*name.kml',
        'file?name.kml',
        'file[name].kml',
        'file{name}.kml',
        'file name.kml', // space
        'file\tname.kml', // tab
        'file\nname.kml' // newline
      ]

      for (const s3Key of invalidKeys) {
        const payload = {
          s3Bucket: 'mmo-uploads',
          s3Key,
          fileType: 'kml'
        }

        const result = geoParserExtract.validate(payload)

        expect(result.error).toBeDefined()
        expect(result.error.details[0].message).toBe('S3_KEY_INVALID')
      }
    })

    it('should reject s3Key with path traversal attempts', () => {
      const pathTraversalKeys = [
        '../file.kml',
        '../../file.kml',
        '../../../etc/passwd',
        'folder/../file.kml',
        'folder/../../file.kml',
        '..\\file.kml',
        'folder\\..\\file.kml'
      ]

      for (const s3Key of pathTraversalKeys) {
        const payload = {
          s3Bucket: 'mmo-uploads',
          s3Key,
          fileType: 'kml'
        }

        const result = geoParserExtract.validate(payload)

        expect(result.error).toBeDefined()
        expect(result.error.details[0].message).toBe('S3_KEY_INVALID')
      }
    })

    it('should accept s3Key with legitimate dots in filename', () => {
      const legitimateKeys = [
        'file.name.kml',
        'folder/file.name.kml',
        'version.1.0.kml',
        'data.backup.kml'
      ]

      for (const s3Key of legitimateKeys) {
        const payload = {
          s3Bucket: 'mmo-uploads',
          s3Key,
          fileType: 'kml'
        }

        const result = geoParserExtract.validate(payload)

        expect(result.error).toBeUndefined()
        expect(result.value.s3Key).toBe(s3Key)
      }
    })
  })

  describe('fileType validation', () => {
    it('should validate valid fileType kml', () => {
      const payload = {
        s3Bucket: 'mmo-uploads',
        s3Key: 'test.kml',
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeUndefined()
      expect(result.value.fileType).toBe('kml')
    })

    it('should validate valid fileType shapefile', () => {
      const payload = {
        s3Bucket: 'mmo-uploads',
        s3Key: 'test.zip',
        fileType: 'shapefile'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeUndefined()
      expect(result.value.fileType).toBe('shapefile')
    })

    it('should normalize fileType to lowercase', () => {
      const testCases = [
        { input: 'KML', expected: 'kml' },
        { input: 'Kml', expected: 'kml' },
        { input: 'kML', expected: 'kml' },
        { input: 'SHAPEFILE', expected: 'shapefile' },
        { input: 'Shapefile', expected: 'shapefile' },
        { input: 'ShapeFile', expected: 'shapefile' },
        { input: 'SHAPE FILE', expected: 'shapefile' }
      ]

      // Note: The last one with space should fail pattern validation first
      for (const testCase of testCases.slice(0, -1)) {
        const payload = {
          s3Bucket: 'mmo-uploads',
          s3Key: 'test.file',
          fileType: testCase.input
        }

        const result = geoParserExtract.validate(payload)

        expect(result.error).toBeUndefined()
        expect(result.value.fileType).toBe(testCase.expected)
      }
    })

    it('should reject missing fileType', () => {
      const payload = {
        s3Bucket: 'mmo-uploads',
        s3Key: 'test.kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeDefined()
      expect(result.error.details[0].message).toBe('FILE_TYPE_REQUIRED')
    })

    it('should reject empty fileType', () => {
      const payload = {
        s3Bucket: 'mmo-uploads',
        s3Key: 'test.kml',
        fileType: ''
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeDefined()
      expect(result.error.details[0].message).toBe('FILE_TYPE_REQUIRED')
    })

    it('should reject null fileType', () => {
      const payload = {
        s3Bucket: 'mmo-uploads',
        s3Key: 'test.kml',
        fileType: null
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeDefined()
      expect(result.error.details[0].message).toBe(
        '"fileType" must be a string'
      )
    })

    it('should reject invalid fileType', () => {
      const invalidFileTypes = [
        'pdf',
        'txt',
        'json',
        'geojson',
        'shp',
        'kmz',
        'gpx',
        'invalid',
        'xml',
        'zip'
      ]

      for (const fileType of invalidFileTypes) {
        const payload = {
          s3Bucket: 'mmo-uploads',
          s3Key: 'test.file',
          fileType
        }

        const result = geoParserExtract.validate(payload)

        expect(result.error).toBeDefined()
        expect(result.error.details[0].message).toBe('FILE_TYPE_INVALID')
      }
    })
  })

  describe('Complete payload validation', () => {
    it('should validate complete valid payload', () => {
      const payload = {
        s3Bucket: 'mmo-uploads',
        s3Key: 'folder/subfolder/test-file.kml',
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeUndefined()
      expect(result.value).toEqual({
        s3Bucket: 'mmo-uploads',
        s3Key: 'folder/subfolder/test-file.kml',
        fileType: 'kml'
      })
    })

    it('should validate complete valid payload with shapefile', () => {
      const payload = {
        s3Bucket: 'production-uploads',
        s3Key: 'data/2023/november/boundaries.zip',
        fileType: 'SHAPEFILE'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeUndefined()
      expect(result.value).toEqual({
        s3Bucket: 'production-uploads',
        s3Key: 'data/2023/november/boundaries.zip',
        fileType: 'shapefile'
      })
    })

    it('should reject payload with extra fields', () => {
      const payload = {
        s3Bucket: 'mmo-uploads',
        s3Key: 'test.kml',
        fileType: 'kml',
        extraField: 'should not be here'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeDefined()
    })

    it('should handle payload with wrong data types', () => {
      const payloads = [
        {
          s3Bucket: 123,
          s3Key: 'test.kml',
          fileType: 'kml'
        },
        {
          s3Bucket: 'mmo-uploads',
          s3Key: 456,
          fileType: 'kml'
        },
        {
          s3Bucket: 'mmo-uploads',
          s3Key: 'test.kml',
          fileType: 789
        }
      ]

      for (const payload of payloads) {
        const result = geoParserExtract.validate(payload)

        expect(result.error).toBeDefined()
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle s3Key with minimum length', () => {
      const payload = {
        s3Bucket: 'mmo-uploads',
        s3Key: 'a',
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeUndefined()
      expect(result.value.s3Key).toBe('a')
    })

    it('should handle s3Key with UUID-like format', () => {
      const payload = {
        s3Bucket: 'mmo-uploads',
        s3Key: '550e8400-e29b-41d4-a716-446655440000.kml',
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeUndefined()
      expect(result.value.s3Key).toBe(
        '550e8400-e29b-41d4-a716-446655440000.kml'
      )
    })

    it('should handle s3Key with nested folder structure', () => {
      const payload = {
        s3Bucket: 'mmo-uploads',
        s3Key: 'level1/level2/level3/level4/file.kml',
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeUndefined()
      expect(result.value.s3Key).toBe('level1/level2/level3/level4/file.kml')
    })

    it('should handle s3Bucket with minimum valid name', () => {
      const payload = {
        s3Bucket: 'a',
        s3Key: 'test.kml',
        fileType: 'kml'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeUndefined()
      expect(result.value.s3Bucket).toBe('a')
    })

    it('should handle mixed case in all fields', () => {
      const payload = {
        s3Bucket: 'MMO-Uploads',
        s3Key: 'TEST-File.KML',
        fileType: 'KML'
      }

      const result = geoParserExtract.validate(payload)

      expect(result.error).toBeUndefined()
      expect(result.value).toEqual({
        s3Bucket: 'MMO-Uploads',
        s3Key: 'TEST-File.KML',
        fileType: 'kml'
      })
    })
  })

  describe('Security validation', () => {
    it('should prevent basic path traversal', () => {
      const pathTraversalAttempts = [
        '../',
        '../../',
        '../../../',
        '..\\',
        '..\\..\\',
        'folder/../',
        'folder/../../'
      ]

      for (const attempt of pathTraversalAttempts) {
        const payload = {
          s3Bucket: 'mmo-uploads',
          s3Key: `${attempt}file.kml`,
          fileType: 'kml'
        }

        const result = geoParserExtract.validate(payload)

        expect(result.error).toBeDefined()
        expect(result.error.details[0].message).toBe('S3_KEY_INVALID')
      }
    })

    it('should prevent encoded path traversal', () => {
      const encodedAttempts = ['%2e%2e%2f', '%2e%2e%5c', '%252e%252e%252f']

      for (const attempt of encodedAttempts) {
        const payload = {
          s3Bucket: 'mmo-uploads',
          s3Key: `${attempt}file.kml`,
          fileType: 'kml'
        }

        const result = geoParserExtract.validate(payload)

        expect(result.error).toBeDefined()
        expect(result.error.details[0].message).toBe('S3_KEY_INVALID')
      }
    })

    it('should prevent null byte injection', () => {
      const nullByteAttempts = ['file.kml\x00', 'file\x00.kml', '\x00file.kml']

      for (const attempt of nullByteAttempts) {
        const payload = {
          s3Bucket: 'mmo-uploads',
          s3Key: attempt,
          fileType: 'kml'
        }

        const result = geoParserExtract.validate(payload)

        expect(result.error).toBeDefined()
        expect(result.error.details[0].message).toBe('S3_KEY_INVALID')
      }
    })

    it('should prevent control character injection', () => {
      const controlCharAttempts = [
        'file\r\n.kml',
        'file\t.kml',
        'file\x01.kml',
        'file\x1f.kml'
      ]

      for (const attempt of controlCharAttempts) {
        const payload = {
          s3Bucket: 'mmo-uploads',
          s3Key: attempt,
          fileType: 'kml'
        }

        const result = geoParserExtract.validate(payload)

        expect(result.error).toBeDefined()
        expect(result.error.details[0].message).toBe('S3_KEY_INVALID')
      }
    })
  })
})
