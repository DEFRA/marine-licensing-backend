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
  test('Should join a nested field path with dots', () => {
    const mockRequest = {}
    const mockToolkit = {}
    const mockError = {
      message: 'Validation failed',
      name: 'ValidationError',
      details: [
        {
          message: 'COORDINATES_LATITUDE_REQUIRED',
          path: ['siteDetails', 0, 'coordinates', 'latitude'],
          type: 'any.required'
        },
        {
          message: 'PROJECT_NAME_REQUIRED',
          path: ['projectName'],
          type: 'any.required'
        }
      ],
      output: {
        payload: {
          validation: {
            source: 'payload',
            keys: ['siteDetails.0.coordinates.latitude', 'projectName']
          }
        }
      }
    }

    try {
      failAction(mockRequest, mockToolkit, mockError)
      expect.unreachable('failAction should rethrow the validation error')
    } catch (error) {
      expect(error.output.payload.validation.details).toEqual([
        {
          field: 'siteDetails.0.coordinates.latitude',
          message: 'COORDINATES_LATITUDE_REQUIRED',
          type: 'any.required'
        },
        {
          field: 'projectName',
          message: 'PROJECT_NAME_REQUIRED',
          type: 'any.required'
        }
      ])
    }
  })
})
