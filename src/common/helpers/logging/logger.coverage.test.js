const actualLoggerModule = jest.requireActual('./logger.js')
const { createLogger } = actualLoggerModule

describe('logger.js implementation', () => {
  test('createLogger should be a function', () => {
    expect(typeof createLogger).toBe('function')
  })

  test('createLogger should return a logger object with expected methods', () => {
    const logger = createLogger()

    expect(typeof logger).toBe('object')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
  })
})
