import { geoParserExtract } from './geo-parser-extract.js'

describe('geoParserExtract validation schema', () => {
  const createPayload = (overrides = {}) => ({
    s3Bucket: 'mmo-uploads',
    s3Key: 'test.kml',
    fileType: 'kml',
    ...overrides
  })

  const validatePayload = (payload) => geoParserExtract.validate(payload)

  const expectValidPayload = (result, expectedValues = {}) => {
    expect(result.error).toBeUndefined()
    Object.entries(expectedValues).forEach(([key, value]) => {
      expect(result.value[key]).toBe(value)
    })
  }

  const expectInvalidPayload = (result, expectedMessage) => {
    expect(result.error).toBeDefined()
    expect(result.error.details[0].message).toBe(expectedMessage)
  }

  const testMultipleValues = (values, createPayloadFunc, assertionFunc) => {
    values.forEach((value) => {
      const payload = createPayloadFunc(value)
      const result = validatePayload(payload)
      assertionFunc(result, value)
    })
  }
  describe('s3Bucket validation', () => {
    it('should validate valid s3Bucket', () => {
      const payload = createPayload({ s3Bucket: 'mmo-uploads' })
      const result = validatePayload(payload)
      expectValidPayload(result, { s3Bucket: 'mmo-uploads' })
    })

    it('should reject missing s3Bucket', () => {
      const payload = createPayload()
      delete payload.s3Bucket
      const result = validatePayload(payload)
      expectInvalidPayload(result, 'S3_BUCKET_REQUIRED')
    })

    it('should reject empty s3Bucket', () => {
      const payload = createPayload({ s3Bucket: '' })
      const result = validatePayload(payload)
      expectInvalidPayload(result, 'S3_BUCKET_REQUIRED')
    })

    it('should reject null s3Bucket', () => {
      const payload = createPayload({ s3Bucket: null })
      const result = validatePayload(payload)
      expectInvalidPayload(result, '"s3Bucket" must be a string')
    })

    it('should handle s3Bucket with special characters', () => {
      const payload = createPayload({ s3Bucket: 'mmo-uploads-test' })
      const result = validatePayload(payload)
      expectValidPayload(result, { s3Bucket: 'mmo-uploads-test' })
    })

    it('should handle s3Bucket with numbers', () => {
      const payload = createPayload({ s3Bucket: 'mmo-uploads-123' })
      const result = validatePayload(payload)
      expectValidPayload(result, { s3Bucket: 'mmo-uploads-123' })
    })
  })

  describe('s3Key validation', () => {
    it('should validate valid s3Key', () => {
      const payload = createPayload({ s3Key: 'folder/test-file.kml' })
      const result = validatePayload(payload)
      expectValidPayload(result, { s3Key: 'folder/test-file.kml' })
    })

    it('should reject missing s3Key', () => {
      const payload = createPayload()
      delete payload.s3Key
      const result = validatePayload(payload)
      expectInvalidPayload(result, 'S3_KEY_REQUIRED')
    })

    it('should reject empty s3Key', () => {
      const payload = createPayload({ s3Key: '' })
      const result = validatePayload(payload)
      expectInvalidPayload(result, 'S3_KEY_REQUIRED')
    })

    it('should reject s3Key that is too long', () => {
      const longKey = 'a'.repeat(1025)
      const payload = createPayload({ s3Key: longKey })
      const result = validatePayload(payload)
      expectInvalidPayload(result, 'S3_KEY_INVALID')
    })

    it('should accept s3Key at maximum length', () => {
      const maxKey = 'a'.repeat(1024)
      const payload = createPayload({ s3Key: maxKey })
      const result = validatePayload(payload)
      expectValidPayload(result, { s3Key: maxKey })
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

      testMultipleValues(
        validKeys,
        (s3Key) => createPayload({ s3Key }),
        (result, s3Key) => expectValidPayload(result, { s3Key })
      )
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

      testMultipleValues(
        invalidKeys,
        (s3Key) => createPayload({ s3Key }),
        (result) => expectInvalidPayload(result, 'S3_KEY_INVALID')
      )
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

      testMultipleValues(
        pathTraversalKeys,
        (s3Key) => createPayload({ s3Key }),
        (result) => expectInvalidPayload(result, 'S3_KEY_INVALID')
      )
    })

    it('should accept s3Key with legitimate dots in filename', () => {
      const legitimateKeys = [
        'file.name.kml',
        'folder/file.name.kml',
        'version.1.0.kml',
        'data.backup.kml'
      ]

      testMultipleValues(
        legitimateKeys,
        (s3Key) => createPayload({ s3Key }),
        (result, s3Key) => expectValidPayload(result, { s3Key })
      )
    })
  })

  describe('fileType validation', () => {
    it('should validate valid fileType kml', () => {
      const payload = createPayload({ fileType: 'kml' })
      const result = validatePayload(payload)
      expectValidPayload(result, { fileType: 'kml' })
    })

    it('should validate valid fileType shapefile', () => {
      const payload = createPayload({
        s3Key: 'test.zip',
        fileType: 'shapefile'
      })
      const result = validatePayload(payload)
      expectValidPayload(result, { fileType: 'shapefile' })
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
      const payload = createPayload()
      delete payload.fileType
      const result = validatePayload(payload)
      expectInvalidPayload(result, 'FILE_TYPE_REQUIRED')
    })

    it('should reject empty fileType', () => {
      const payload = createPayload({ fileType: '' })
      const result = validatePayload(payload)
      expectInvalidPayload(result, 'FILE_TYPE_REQUIRED')
    })

    it('should reject null fileType', () => {
      const payload = createPayload({ fileType: null })
      const result = validatePayload(payload)
      expectInvalidPayload(result, '"fileType" must be a string')
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

      testMultipleValues(
        invalidFileTypes,
        (fileType) => createPayload({ s3Key: 'test.file', fileType }),
        (result) => expectInvalidPayload(result, 'FILE_TYPE_INVALID')
      )
    })
  })

  describe('Complete payload validation', () => {
    it('should validate complete valid payload', () => {
      const payload = createPayload({ s3Key: 'folder/subfolder/test-file.kml' })
      const result = validatePayload(payload)
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual({
        s3Bucket: 'mmo-uploads',
        s3Key: 'folder/subfolder/test-file.kml',
        fileType: 'kml'
      })
    })

    it('should validate complete valid payload with shapefile', () => {
      const payload = createPayload({
        s3Bucket: 'production-uploads',
        s3Key: 'data/2023/november/boundaries.zip',
        fileType: 'SHAPEFILE'
      })
      const result = validatePayload(payload)
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual({
        s3Bucket: 'production-uploads',
        s3Key: 'data/2023/november/boundaries.zip',
        fileType: 'shapefile'
      })
    })

    it('should reject payload with extra fields', () => {
      const payload = createPayload({ extraField: 'should not be here' })
      const result = validatePayload(payload)
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

      payloads.forEach((payload) => {
        const result = validatePayload(payload)
        expect(result.error).toBeDefined()
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle s3Key with minimum length', () => {
      const payload = createPayload({ s3Key: 'a' })
      const result = validatePayload(payload)
      expectValidPayload(result, { s3Key: 'a' })
    })

    it('should handle s3Key with UUID-like format', () => {
      const s3Key = '550e8400-e29b-41d4-a716-446655440000.kml'
      const payload = createPayload({ s3Key })
      const result = validatePayload(payload)
      expectValidPayload(result, { s3Key })
    })

    it('should handle s3Key with nested folder structure', () => {
      const s3Key = 'level1/level2/level3/level4/file.kml'
      const payload = createPayload({ s3Key })
      const result = validatePayload(payload)
      expectValidPayload(result, { s3Key })
    })

    it('should handle s3Bucket with minimum valid name', () => {
      const payload = createPayload({ s3Bucket: 'a' })
      const result = validatePayload(payload)
      expectValidPayload(result, { s3Bucket: 'a' })
    })

    it('should handle mixed case in all fields', () => {
      const payload = createPayload({
        s3Bucket: 'MMO-Uploads',
        s3Key: 'TEST-File.KML',
        fileType: 'KML'
      })
      const result = validatePayload(payload)
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

      testMultipleValues(
        pathTraversalAttempts,
        (attempt) => createPayload({ s3Key: `${attempt}file.kml` }),
        (result) => expectInvalidPayload(result, 'S3_KEY_INVALID')
      )
    })

    it('should prevent encoded path traversal', () => {
      const encodedAttempts = ['%2e%2e%2f', '%2e%2e%5c', '%252e%252e%252f']

      testMultipleValues(
        encodedAttempts,
        (attempt) => createPayload({ s3Key: `${attempt}file.kml` }),
        (result) => expectInvalidPayload(result, 'S3_KEY_INVALID')
      )
    })

    it('should prevent null byte injection', () => {
      const nullByteAttempts = ['file.kml\x00', 'file\x00.kml', '\x00file.kml']

      testMultipleValues(
        nullByteAttempts,
        (attempt) => createPayload({ s3Key: attempt }),
        (result) => expectInvalidPayload(result, 'S3_KEY_INVALID')
      )
    })

    it('should prevent control character injection', () => {
      const controlCharAttempts = [
        'file\r\n.kml',
        'file\t.kml',
        'file\x01.kml',
        'file\x1f.kml'
      ]

      testMultipleValues(
        controlCharAttempts,
        (attempt) => createPayload({ s3Key: attempt }),
        (result) => expectInvalidPayload(result, 'S3_KEY_INVALID')
      )
    })
  })
})
