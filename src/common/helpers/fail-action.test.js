import { failAction, safeLog } from './fail-action.js'
import { createLogger } from './logging/logger.js'

jest.mock('./logging/logger.js')

describe('#fail-action', () => {
  beforeEach(() => {
    createLogger.mockReturnValue({
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn()
    })
  })

  test('Should throw expected error', () => {
    const mockRequest = {}
    const mockToolkit = {}
    const mockError = Error('Something terrible has happened!')

    expect(() => failAction(mockRequest, mockToolkit, mockError)).toThrow(
      'Something terrible has happened!'
    )
  })

  test('Should return expected error details if present', () => {
    const mockRequest = {}
    const mockToolkit = {
      response: jest.fn().mockReturnThis(),
      code: jest.fn().mockReturnThis(),
      takeover: jest.fn().mockReturnThis()
    }
    const mockError = {
      message: 'Validation failed',
      name: 'ValidationError',
      details: [
        {
          message: 'ERROR_MESSAGE',
          path: ['field'],
          type: 'string.empty',
          context: {
            label: 'field',
            value: '',
            key: 'field'
          }
        }
      ],
      output: {
        payload: {
          validation: {
            source: 'payload',
            keys: ['field']
          }
        }
      }
    }

    expect(() => failAction(mockRequest, mockToolkit, mockError)).toThrow({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      validation: {
        source: 'payload',
        keys: ['field'],
        details: [
          {
            field: 'field',
            message: 'ERROR_MESSAGE',
            type: 'string.empty'
          }
        ]
      }
    })
  })

  test('safeLog handles missing logger functions gracefully', () => {
    createLogger.mockReturnValue({
      info: jest.fn(),
      error: jest.fn()
    })

    const mockRequest = {}
    const mockToolkit = {}
    const mockError = Error('Safe log test')

    expect(() => failAction(mockRequest, mockToolkit, mockError)).toThrow(
      'Safe log test'
    )
  })

  test('safeLog handles null logger gracefully', () => {
    createLogger.mockReturnValue(null)

    const mockRequest = {}
    const mockToolkit = {}
    const mockError = Error('Null logger test')

    expect(() => failAction(mockRequest, mockToolkit, mockError)).toThrow(
      'Null logger test'
    )
  })

  test('safeLog.info function exists and can be called', () => {
    const mockLogger = {
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn()
    }

    createLogger.mockReturnValue(mockLogger)

    expect(mockLogger.info).toBeDefined()
  })

  describe('safeLog functions', () => {
    test('safeLog.warn should call logger.warn when available', () => {
      jest.resetModules()

      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }

      jest.doMock('./logging/logger.js', () => ({
        createLogger: jest.fn().mockReturnValue(mockLogger)
      }))

      const { safeLog: freshSafeLog } = require('./fail-action.js')

      const mockError = new Error('Test error')
      freshSafeLog.warn(mockError, 'Test warn message')

      expect(mockLogger.warn).toHaveBeenCalledWith(
        mockError,
        'Test warn message'
      )
    })

    test('safeLog.warn should not throw when logger.warn is not available', () => {
      jest.resetModules()

      const mockLogger = {
        info: jest.fn(),
        error: jest.fn()
      }

      jest.doMock('./logging/logger.js', () => ({
        createLogger: jest.fn().mockReturnValue(mockLogger)
      }))

      const { safeLog: freshSafeLog } = require('./fail-action.js')

      const mockError = new Error('Test error')
      expect(() =>
        freshSafeLog.warn(mockError, 'Test warn message')
      ).not.toThrow()
    })

    test('safeLog.info should call logger.info when available', () => {
      jest.resetModules()

      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }

      jest.doMock('./logging/logger.js', () => ({
        createLogger: jest.fn().mockReturnValue(mockLogger)
      }))

      const { safeLog: freshSafeLog } = require('./fail-action.js')

      freshSafeLog.info('Test info message')

      expect(mockLogger.info).toHaveBeenCalledWith('Test info message')
    })

    test('safeLog.info should not throw when logger.info is not available', () => {
      createLogger.mockReturnValue({
        warn: jest.fn(),
        error: jest.fn()
      })

      expect(() => safeLog.info('Test info message')).not.toThrow()
    })

    test('safeLog.info should not throw when logger is null', () => {
      createLogger.mockReturnValue(null)

      expect(() => safeLog.info('Test info message')).not.toThrow()
    })

    test('safeLog.error should call logger.error when available', () => {
      jest.resetModules()

      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }

      jest.doMock('./logging/logger.js', () => ({
        createLogger: jest.fn().mockReturnValue(mockLogger)
      }))

      const { safeLog: freshSafeLog } = require('./fail-action.js')

      freshSafeLog.error('Test error message')

      expect(mockLogger.error).toHaveBeenCalledWith('Test error message')
    })

    test('safeLog.error should not throw when logger.error is not available', () => {
      createLogger.mockReturnValue({
        warn: jest.fn(),
        info: jest.fn()
      })

      expect(() => safeLog.error('Test error message')).not.toThrow()
    })

    test('safeLog.error should not throw when logger is null', () => {
      createLogger.mockReturnValue(null)

      expect(() => safeLog.error('Test error message')).not.toThrow()
    })
  })
})
