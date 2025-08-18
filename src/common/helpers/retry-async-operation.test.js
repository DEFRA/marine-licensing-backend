import { retryAsyncOperation } from './retry-async-operation.js'

describe('retryAsyncOperation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Happy Path - Successful Operations', () => {
    it('should resolve immediately on first successful attempt', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success')

      const result = await retryAsyncOperation({
        operation: mockOperation,
        retries: 3,
        intervalMs: 1000
      })

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(1)
    })

    it('should return the correct result from successful operation', async () => {
      const expectedResult = { data: 'test-data', id: 123 }
      const mockOperation = jest.fn().mockResolvedValue(expectedResult)

      const result = await retryAsyncOperation({
        operation: mockOperation,
        retries: 3,
        intervalMs: 1000
      })

      expect(result).toEqual(expectedResult)
    })

    it('should work with custom interval timing', async () => {
      const mockOperation = jest.fn().mockResolvedValue('custom-timing')

      const result = await retryAsyncOperation({
        operation: mockOperation,
        retries: 3,
        intervalMs: 500
      })

      expect(result).toBe('custom-timing')
    })
  })

  describe('Retry Logic - Failing then Succeeding', () => {
    it('should retry and succeed on second attempt', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success on retry')

      const result = await retryAsyncOperation({
        operation: mockOperation,
        retries: 3,
        intervalMs: 5
      })

      expect(result).toBe('success on retry')
      expect(mockOperation).toHaveBeenCalledTimes(2)
    })

    it('should retry and succeed on third attempt', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success on third try')

      const result = await retryAsyncOperation({
        operation: mockOperation,
        retries: 3,
        intervalMs: 5
      })

      expect(result).toBe('success on third try')
      expect(mockOperation).toHaveBeenCalledTimes(3)
    })

    it('should respect custom retry count', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockRejectedValueOnce(new Error('Third failure'))
        .mockRejectedValueOnce(new Error('Fourth failure'))
        .mockResolvedValueOnce('success on fifth try')

      const result = await retryAsyncOperation({
        operation: mockOperation,
        retries: 5,
        intervalMs: 5
      })

      expect(result).toBe('success on fifth try')
      expect(mockOperation).toHaveBeenCalledTimes(5)
    })
  })

  describe('Error Handling - Maximum Retries Exceeded', () => {
    it('should reject after default 3 retries when all attempts fail', async () => {
      const expectedError = new Error('Persistent failure')
      const mockOperation = jest.fn().mockRejectedValue(expectedError)

      await expect(
        retryAsyncOperation({
          operation: mockOperation,
          retries: 3,
          intervalMs: 5
        })
      ).rejects.toThrow('Persistent failure')
      expect(mockOperation).toHaveBeenCalledTimes(3)
    })

    it('should reject with the last error encountered', async () => {
      const firstError = new Error('First error')
      const secondError = new Error('Second error')
      const thirdError = new Error('Third error')

      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(firstError)
        .mockRejectedValueOnce(secondError)
        .mockRejectedValueOnce(thirdError)

      await expect(
        retryAsyncOperation({
          operation: mockOperation,
          retries: 3,
          intervalMs: 5
        })
      ).rejects.toThrow('Third error')
    })

    it('should respect custom retry count before rejecting', async () => {
      const expectedError = new Error('Custom retry failure')
      const mockOperation = jest.fn().mockRejectedValue(expectedError)

      await expect(
        retryAsyncOperation({
          operation: mockOperation,
          retries: 2,
          intervalMs: 5
        })
      ).rejects.toThrow('Custom retry failure')
      expect(mockOperation).toHaveBeenCalledTimes(2)
    })

    it('should execute the operation once only if zero retries specified', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success')

      const result = await retryAsyncOperation({
        operation: mockOperation,
        retries: 0,
        intervalMs: 1000
      })

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(1)
    })
  })

  describe('Timing and Intervals', () => {
    it('should respect custom interval timing between retries', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success')

      const startTime = Date.now()
      const result = await retryAsyncOperation({
        operation: mockOperation,
        intervalMs: 50
      })
      const endTime = Date.now()

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(2)
      // Verify that some time passed for the retry interval
      expect(endTime - startTime).toBeGreaterThanOrEqual(45)
    })

    it('should call operation immediately without waiting for interval', async () => {
      const mockOperation = jest.fn().mockResolvedValue('immediate')

      const result = await retryAsyncOperation({
        operation: mockOperation,
        retries: 3,
        intervalMs: 1000
      })

      // Operation should be called immediately without advancing timers
      expect(result).toBe('immediate')
      expect(mockOperation).toHaveBeenCalledTimes(1)
    })
  })

  describe('Parameter Validation and Edge Cases', () => {
    it('should work when all parameters are explicitly provided', async () => {
      const mockOperation = jest.fn().mockResolvedValue('explicit-params')

      const result = await retryAsyncOperation({
        operation: mockOperation,
        retries: 3,
        intervalMs: 1000
      })

      expect(result).toBe('explicit-params')
    })

    it('should handle operation that returns null', async () => {
      const mockOperation = jest.fn().mockResolvedValue(null)

      const result = await retryAsyncOperation({
        operation: mockOperation,
        retries: 3,
        intervalMs: 1000
      })

      expect(result).toBeNull()
    })

    it('should handle operation that returns undefined', async () => {
      const mockOperation = jest.fn().mockResolvedValue(undefined)

      const result = await retryAsyncOperation({
        operation: mockOperation,
        retries: 3,
        intervalMs: 1000
      })

      expect(result).toBeUndefined()
    })

    it('should handle operation that returns false', async () => {
      const mockOperation = jest.fn().mockResolvedValue(false)

      const result = await retryAsyncOperation({
        operation: mockOperation,
        retries: 3,
        intervalMs: 1000
      })

      expect(result).toBe(false)
    })
  })

  describe('Memory and Resource Management', () => {
    it('should clear interval on successful completion after retry', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success')
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      await retryAsyncOperation({
        operation: mockOperation,
        intervalMs: 5
      })

      expect(clearIntervalSpy).toHaveBeenCalled()
      clearIntervalSpy.mockRestore()
    })

    it('should clear interval on final failure', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Failure'))
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      try {
        await retryAsyncOperation({
          operation: mockOperation,
          retries: 2,
          intervalMs: 5
        })
      } catch (error) {
        // Expected to fail
      }

      expect(clearIntervalSpy).toHaveBeenCalled()
      clearIntervalSpy.mockRestore()
    })
  })

  describe('Async Operation Behavior', () => {
    it('should handle async operations that take time to resolve', async () => {
      const mockOperation = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve('delayed-success'), 10)
        })
      })

      const result = await retryAsyncOperation({
        operation: mockOperation,
        retries: 3,
        intervalMs: 1000
      })

      expect(result).toBe('delayed-success')
    })

    it('should handle async operations that reject asynchronously', async () => {
      const mockOperation = jest
        .fn()
        .mockImplementationOnce(() => {
          return new Promise((_resolve, reject) => {
            setTimeout(() => reject(new Error('delayed-error')), 10)
          })
        })
        .mockResolvedValueOnce('success-after-delay')

      const result = await retryAsyncOperation({
        operation: mockOperation,
        intervalMs: 5
      })

      expect(result).toBe('success-after-delay')
      expect(mockOperation).toHaveBeenCalledTimes(2)
    })
  })

  describe('Default Parameters', () => {
    it('should use default retries (3) when retries parameter is not provided', async () => {
      const expectedError = new Error('Persistent failure')
      const mockOperation = jest.fn().mockRejectedValue(expectedError)

      await expect(
        retryAsyncOperation({
          operation: mockOperation,
          intervalMs: 5 // Provide intervalMs to speed up test
        })
      ).rejects.toThrow('Persistent failure')

      // Should retry 3 times (default) before failing
      expect(mockOperation).toHaveBeenCalledTimes(3)
    })

    it('should use default intervalMs (1000) when intervalMs parameter is not provided', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success on retry')

      const startTime = Date.now()
      const result = await retryAsyncOperation({
        operation: mockOperation,
        retries: 2 // Limit retries to speed up test
      })
      const endTime = Date.now()

      expect(result).toBe('success on retry')
      expect(mockOperation).toHaveBeenCalledTimes(2)
      // Verify that approximately 1000ms passed for the default interval
      expect(endTime - startTime).toBeGreaterThanOrEqual(950)
      expect(endTime - startTime).toBeLessThan(1200) // Allow some tolerance
    })

    it('should use both default parameters when neither retries nor intervalMs are provided', async () => {
      const expectedError = new Error('Default params failure')
      const mockOperation = jest.fn().mockRejectedValue(expectedError)

      const startTime = Date.now()
      await expect(
        retryAsyncOperation({
          operation: mockOperation
        })
      ).rejects.toThrow('Default params failure')
      const endTime = Date.now()

      // Should use default retries (3)
      expect(mockOperation).toHaveBeenCalledTimes(3)
      // Should use default intervalMs (1000ms), so roughly 2000ms total (2 intervals)
      expect(endTime - startTime).toBeGreaterThanOrEqual(1900)
      expect(endTime - startTime).toBeLessThan(2200) // Allow some tolerance
    })

    it('should succeed immediately with defaults when operation succeeds on first attempt', async () => {
      const mockOperation = jest.fn().mockResolvedValue('immediate-success')

      const result = await retryAsyncOperation({
        operation: mockOperation
      })

      expect(result).toBe('immediate-success')
      expect(mockOperation).toHaveBeenCalledTimes(1)
    })

    it('should retry once with defaults and succeed on second attempt', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success with defaults')

      const startTime = Date.now()
      const result = await retryAsyncOperation({
        operation: mockOperation
      })
      const endTime = Date.now()

      expect(result).toBe('success with defaults')
      expect(mockOperation).toHaveBeenCalledTimes(2)
      // Should wait default interval (1000ms) between attempts
      expect(endTime - startTime).toBeGreaterThanOrEqual(950)
      expect(endTime - startTime).toBeLessThan(1200)
    })

    it('should handle partial default usage - only operation and retries provided', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success with partial defaults')

      const startTime = Date.now()
      const result = await retryAsyncOperation({
        operation: mockOperation,
        retries: 2
      })
      const endTime = Date.now()

      expect(result).toBe('success with partial defaults')
      expect(mockOperation).toHaveBeenCalledTimes(2)
      // Should use default intervalMs (1000ms)
      expect(endTime - startTime).toBeGreaterThanOrEqual(950)
      expect(endTime - startTime).toBeLessThan(1200)
    })

    it('should handle partial default usage - only operation and intervalMs provided', async () => {
      const expectedError = new Error('Partial defaults failure')
      const mockOperation = jest.fn().mockRejectedValue(expectedError)

      await expect(
        retryAsyncOperation({
          operation: mockOperation,
          intervalMs: 10 // Fast interval for testing
        })
      ).rejects.toThrow('Partial defaults failure')

      // Should use default retries (3)
      expect(mockOperation).toHaveBeenCalledTimes(3)
    })
  })
})
