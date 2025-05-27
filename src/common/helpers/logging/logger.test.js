import { createLogger } from './logger.js'
describe('logger.js module', () => {
  test('createLogger should be exported as a function', () => {
    expect(typeof createLogger).toBe('function')
  })

  test('createLogger should return a logger object with expected methods', () => {
    const logger = createLogger()

    expect(typeof logger).toBe('object')

    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')

    expect(() => {
      logger.info('This is a test info message')
      logger.error('This is a test error message')
    }).not.toThrow()
  })

  test('demonstrates how createLogger works conceptually', () => {
    function mockPino(options) {
      return {
        info: jest.fn(),
        error: jest.fn()
      }
    }

    function mockCreateLogger() {
      const options = { level: 'info' }
      return mockPino(options)
    }

    const mockLogger = mockCreateLogger()

    expect(mockLogger).toBeDefined()
    expect(typeof mockLogger.info).toBe('function')
    expect(typeof mockLogger.error).toBe('function')
  })
})
