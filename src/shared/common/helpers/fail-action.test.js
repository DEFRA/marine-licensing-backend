import { vi } from 'vitest'
import { failAction } from './fail-action.js'

describe('#fail-action', () => {
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
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      takeover: vi.fn().mockReturnThis()
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

    expect(() => failAction(mockRequest, mockToolkit, mockError)).toThrow()

    try {
      failAction(mockRequest, mockToolkit, mockError)
    } catch (error) {
      expect(error.output.payload.validation).toEqual({
        source: 'payload',
        keys: ['field'],
        details: [
          {
            field: 'field',
            message: 'ERROR_MESSAGE',
            type: 'string.empty'
          }
        ]
      })
    }
  })
})
