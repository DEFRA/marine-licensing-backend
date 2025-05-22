import { failAction } from './fail-action.js'
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
})
