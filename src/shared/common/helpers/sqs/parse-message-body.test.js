import { vi } from 'vitest'
import { parseMessageBody } from './parse-message-body.js'

describe('parseMessageBody', () => {
  const buildLogger = () => ({ error: vi.fn() })
  const discardMessage = 'Discarding malformed message'

  it('should return the parsed body when the JSON is valid', () => {
    const logger = buildLogger()
    const message = { Body: JSON.stringify({ foo: 'bar' }) }

    const result = parseMessageBody(message, logger, discardMessage)

    expect(result).toEqual({ foo: 'bar' })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('should log and return null when the JSON is malformed', () => {
    const logger = buildLogger()
    const message = { Body: 'not json' }

    const result = parseMessageBody(message, logger, discardMessage)

    expect(result).toBeNull()
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Object) }),
      discardMessage
    )
  })

  it('should return the transformed value when a transform is supplied', () => {
    const logger = buildLogger()
    const message = { Body: JSON.stringify({ foo: 'bar' }) }
    const transform = (body) => ({ transformed: body.foo })

    const result = parseMessageBody(message, logger, discardMessage, transform)

    expect(result).toEqual({ transformed: 'bar' })
  })

  it('should log and return null when the transform throws', () => {
    const logger = buildLogger()
    const message = { Body: JSON.stringify({ foo: 'bar' }) }
    const transform = vi.fn(() => {
      throw new Error('invalid shape')
    })

    const result = parseMessageBody(message, logger, discardMessage, transform)

    expect(result).toBeNull()
    expect(transform).toHaveBeenCalledWith({ foo: 'bar' })
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Object) }),
      discardMessage
    )
  })
})
