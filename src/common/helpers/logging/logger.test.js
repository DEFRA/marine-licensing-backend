import { createLogger } from './logger.js'

jest.mock('pino', () => jest.fn())

describe('logger', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should exist', () => {
    expect(typeof createLogger).toBe('function')
  })
})
