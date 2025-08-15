import { ErrorWithData } from './error-with-data.js'

describe('ErrorWithData (custom Error class)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Constructor - Basic Functionality', () => {
    it('should create an instance with message and data', () => {
      const message = 'Test error message'
      const data = { code: 'TEST_ERROR', details: 'Additional info' }

      const error = new ErrorWithData(message, data)

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(ErrorWithData)
      expect(error.message).toBe(message)
      expect(error.data).toEqual(data)
      expect(error.name).toBe('ErrorWithData')
    })

    it('should create an instance with only message (no data)', () => {
      const message = 'Error without data'

      const error = new ErrorWithData(message)

      expect(error.message).toBe(message)
      expect(error.data).toBeUndefined()
      expect(error.name).toBe('ErrorWithData')
    })

    it('should create an instance with null data', () => {
      const message = 'Error with null data'
      const data = null

      const error = new ErrorWithData(message, data)

      expect(error.message).toBe(message)
      expect(error.data).toBeNull()
      expect(error.name).toBe('ErrorWithData')
    })
  })

  describe('Data Property Handling', () => {
    it('should handle object data correctly', () => {
      const complexData = {
        errorCode: 'VALIDATION_FAILED',
        field: 'email',
        value: 'invalid-email',
        constraints: ['must be valid email format'],
        metadata: {
          timestamp: new Date(),
          userId: '12345'
        }
      }

      const error = new ErrorWithData('Validation failed', complexData)

      expect(error.data).toEqual(complexData)
      expect(error.data.errorCode).toBe('VALIDATION_FAILED')
      expect(error.data.metadata.userId).toBe('12345')
    })

    it('should handle array data correctly', () => {
      const arrayData = ['error1', 'error2', 'error3']

      const error = new ErrorWithData('Multiple errors occurred', arrayData)

      expect(error.data).toEqual(arrayData)
      expect(Array.isArray(error.data)).toBe(true)
      expect(error.data).toHaveLength(3)
    })

    it('should handle primitive data types', () => {
      const stringData = 'Simple string data'
      const numberData = 42
      const booleanData = true

      const stringError = new ErrorWithData('String error', stringData)
      const numberError = new ErrorWithData('Number error', numberData)
      const booleanError = new ErrorWithData('Boolean error', booleanData)

      expect(stringError.data).toBe(stringData)
      expect(numberError.data).toBe(numberData)
      expect(booleanError.data).toBe(booleanData)
    })
    it('should handle functions in data', () => {
      const dataWithFunction = {
        message: 'Data with function',
        callback: () => 'test'
      }

      const error = new ErrorWithData('Function data', dataWithFunction)

      expect(error.data.message).toBe('Data with function')
      expect(typeof error.data.callback).toBe('function')
      expect(error.data.callback()).toBe('test')
    })
  })

  describe('Error Properties and Inheritance', () => {
    it('should inherit from Error class', () => {
      const error = new ErrorWithData('Test message')

      expect(error instanceof Error).toBe(true)
      expect(error instanceof ErrorWithData).toBe(true)
    })

    it('should have correct name property', () => {
      const error = new ErrorWithData('Test message')

      expect(error.name).toBe('ErrorWithData')
    })

    it('should have stack trace', () => {
      const error = new ErrorWithData('Test message')

      expect(error.stack).toBeDefined()
      expect(typeof error.stack).toBe('string')
      expect(error.stack).toContain('ErrorWithData')
    })

    it('should be throwable and catchable', () => {
      const message = 'Throwable error'
      const data = { code: 'THROW_TEST' }

      expect(() => {
        throw new ErrorWithData(message, data)
      }).toThrow(ErrorWithData)

      try {
        throw new ErrorWithData(message, data)
      } catch (error) {
        expect(error).toBeInstanceOf(ErrorWithData)
        expect(error.message).toBe(message)
        expect(error.data).toEqual(data)
      }
    })
  })

  describe('Stack Trace Capture', () => {
    it('should capture stack trace when Error.captureStackTrace is available', () => {
      // Mock Error.captureStackTrace
      const originalCaptureStackTrace = Error.captureStackTrace
      const mockCaptureStackTrace = jest.fn()
      Error.captureStackTrace = mockCaptureStackTrace

      const error = new ErrorWithData('Stack trace test')

      expect(mockCaptureStackTrace).toHaveBeenCalledWith(
        error,
        expect.any(Function)
      )

      // Restore original method
      Error.captureStackTrace = originalCaptureStackTrace
    })

    it('should work when Error.captureStackTrace is not available', () => {
      // Mock absence of Error.captureStackTrace
      const originalCaptureStackTrace = Error.captureStackTrace
      delete Error.captureStackTrace

      expect(() => {
        const error = new ErrorWithData('No capture stack trace')
        expect(error.message).toBe('No capture stack trace')
        expect(error.name).toBe('ErrorWithData')
      }).not.toThrow()

      // Restore original method
      Error.captureStackTrace = originalCaptureStackTrace
    })
  })

  describe('Comparison and Equality', () => {
    it('should create distinct instances for each constructor call', () => {
      const message = 'Same message'
      const data1 = { same: 'data' }
      const data2 = { same: 'data' }

      const error1 = new ErrorWithData(message, data1)
      const error2 = new ErrorWithData(message, data2)

      expect(error1).not.toBe(error2)
      expect(error1.message).toBe(error2.message)
      expect(error1.data).toEqual(error2.data)
      expect(error1.data).not.toBe(error2.data) // Different object references
    })

    it('should maintain reference equality for shared data objects', () => {
      const sharedData = { shared: true }
      const error1 = new ErrorWithData('Error 1', sharedData)
      const error2 = new ErrorWithData('Error 2', sharedData)

      expect(error1.data).toBe(error2.data) // Same object reference
      expect(error1.data).toBe(sharedData)
    })
  })
})
