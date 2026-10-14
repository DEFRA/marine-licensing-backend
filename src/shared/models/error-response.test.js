import Boom from '@hapi/boom'
import { errorResponseSchema } from './error-response.js'

describe('errorResponseSchema', () => {
  test.each([
    ['not found', Boom.notFound('Marine licence not found')],
    ['forbidden', Boom.forbidden('Not authorised')],
    ['internal', Boom.internal('boom')]
  ])('accepts a %s Boom payload', (_name, error) => {
    expect(
      errorResponseSchema.validate(error.output.payload).error
    ).toBeUndefined()
  })

  test('accepts a validation error payload', () => {
    const payload = {
      statusCode: 400,
      error: 'Bad Request',
      message: 'MARINE_LICENCE_ID_INVALID',
      validation: {
        source: 'params',
        keys: ['id'],
        details: [
          {
            field: 'id',
            message: 'MARINE_LICENCE_ID_INVALID',
            type: 'string.hex'
          }
        ]
      }
    }

    expect(errorResponseSchema.validate(payload).error).toBeUndefined()
  })

  test('rejects a payload without a status code', () => {
    expect(
      errorResponseSchema.validate({ error: 'Not Found', message: 'x' }).error
    ).toBeDefined()
  })
})
