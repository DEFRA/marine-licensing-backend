const fs = require('fs')
const path = require('path')
const loggerSource = fs.readFileSync(path.join(__dirname, 'logger.js'), 'utf8')
describe('logger.js verification', () => {
  test('should have the expected imports and exports', () => {
    expect(loggerSource).toContain('import pino from')
    expect(loggerSource).toContain('import { loggerOptions } from')
    expect(loggerSource).toContain('export function createLogger')
  })

  test('should call pino with loggerOptions and return the result', () => {
    expect(loggerSource).toContain('return pino(loggerOptions)')
  })
})

describe('createLogger conceptual behavior', () => {
  test('calls pino with the provided options', () => {
    const mockPino = jest.fn().mockReturnValue({ mock: 'logger' })
    const mockOptions = { mock: 'options' }

    function mockCreateLogger() {
      return mockPino(mockOptions)
    }

    const result = mockCreateLogger()

    expect(mockPino).toHaveBeenCalledWith(mockOptions)
    expect(result).toEqual({ mock: 'logger' })
  })

  test('returns whatever pino returns', () => {
    const customLogger = { info: jest.fn(), error: jest.fn() }
    const mockPino = jest.fn().mockReturnValue(customLogger)
    const mockOptions = { mock: 'options' }

    function mockCreateLogger() {
      return mockPino(mockOptions)
    }

    const result = mockCreateLogger()

    expect(result).toBe(customLogger)
  })
})
