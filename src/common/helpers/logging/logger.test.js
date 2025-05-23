import { createLogger } from './logger.js'

// Setup mocks before imports to ensure they're properly mocked
const mockPino = jest.fn().mockReturnValue({ mock: 'logger' })
jest.mock('pino', () => mockPino)

const mockLoggerOptions = { mock: 'options' }
jest.mock('./logger-options.js', () => ({
  loggerOptions: mockLoggerOptions
}))

describe('logger', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  test('should exist', () => {
    expect(typeof createLogger).toBe('function')
  })

  test.skip('should call pino with logger options', () => {
    const result = createLogger()

    // Verify pino was called with the right options
    expect(mockPino).toHaveBeenCalledWith(mockLoggerOptions)

    // Verify the result is what we expect
    expect(result).toEqual({ mock: 'logger' })
  })
})
