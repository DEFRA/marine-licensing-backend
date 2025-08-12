import { retryAsyncOperation } from './retry-async-operation.js'

describe('retryAsyncOperation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  describe('Happy Path - Successful Operations', () => {
    it('should resolve immediately on first successful attempt', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success')

      const promise = retryAsyncOperation({ operation: mockOperation })

      // Fast-forward to trigger the first interval
      jest.advanceTimersByTime(1000)

      const result = await promise

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(1)
    })

    it('should return the correct result from successful operation', async () => {
      const expectedResult = { data: 'test-data', id: 123 }
      const mockOperation = jest.fn().mockResolvedValue(expectedResult)

      const promise = retryAsyncOperation({ operation: mockOperation })

      jest.advanceTimersByTime(1000)

      const result = await promise

      expect(result).toEqual(expectedResult)
    })

    it('should work with custom interval timing', async () => {
      const mockOperation = jest.fn().mockResolvedValue('custom-timing')

      const promise = retryAsyncOperation({
        operation: mockOperation,
        intervalMs: 500
      })

      jest.advanceTimersByTime(500)

      const result = await promise

      expect(result).toBe('custom-timing')
    })
  })

  describe('Retry Logic - Failing then Succeeding', () => {
    it('should retry and succeed on second attempt', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success on retry')

      const promise = retryAsyncOperation({ operation: mockOperation })

      // First attempt fails
      jest.advanceTimersByTime(1000)

      // Second attempt succeeds
      jest.advanceTimersByTime(1000)

      const result = await promise

      expect(result).toBe('success on retry')
      expect(mockOperation).toHaveBeenCalledTimes(2)
    })

    it('should retry and succeed on third attempt', async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success on third try')

      const promise = retryAsyncOperation({ operation: mockOperation })

      // First attempt fails
      jest.advanceTimersByTime(1000)

      // Second attempt fails
      jest.advanceTimersByTime(1000)

      // Third attempt succeeds
      jest.advanceTimersByTime(1000)

      const result = await promise

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

      const promise = retryAsyncOperation({
        operation: mockOperation,
        retries: 5
      })

      // Advance through all attempts
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(1000)
      }

      const result = await promise

      expect(result).toBe('success on fifth try')
      expect(mockOperation).toHaveBeenCalledTimes(5)
    })
  })

  describe('Error Handling - Maximum Retries Exceeded', () => {
    it('should reject after default 3 retries when all attempts fail', async () => {
      const expectedError = new Error('Persistent failure')
      const mockOperation = jest.fn().mockRejectedValue(expectedError)

      const promise = retryAsyncOperation({ operation: mockOperation })

      // Advance through all 3 retry attempts
      jest.advanceTimersByTime(1000) // 1st attempt
      jest.advanceTimersByTime(1000) // 2nd attempt
      jest.advanceTimersByTime(1000) // 3rd attempt

      await expect(promise).rejects.toThrow('Persistent failure')
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

      const promise = retryAsyncOperation({ operation: mockOperation })

      jest.advanceTimersByTime(1000) // 1st attempt
      jest.advanceTimersByTime(1000) // 2nd attempt
      jest.advanceTimersByTime(1000) // 3rd attempt

      await expect(promise).rejects.toThrow('Third error')
    })

    it('should respect custom retry count before rejecting', async () => {
      const expectedError = new Error('Custom retry failure')
      const mockOperation = jest.fn().mockRejectedValue(expectedError)

      const promise = retryAsyncOperation({
        operation: mockOperation,
        retries: 2
      })

      jest.advanceTimersByTime(1000) // 1st attempt
      jest.advanceTimersByTime(1000) // 2nd attempt

      await expect(promise).rejects.toThrow('Custom retry failure')
      expect(mockOperation).toHaveBeenCalledTimes(2)
    })

    it('should execute the operation once only if zero retries specified', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success')

      const promise = retryAsyncOperation({
        operation: mockOperation,
        retries: 0
      })

      // Fast-forward to trigger the first interval
      jest.advanceTimersByTime(1000)

      const result = await promise

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

      const promise = retryAsyncOperation({
        operation: mockOperation,
        intervalMs: 2000
      })

      // First attempt at custom interval
      jest.advanceTimersByTime(2000)

      // Second attempt at custom interval
      jest.advanceTimersByTime(2000)

      const result = await promise

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(2)
    })

    it('should not call operation before first interval', async () => {
      const mockOperation = jest.fn().mockResolvedValue('immediate')

      const promise = retryAsyncOperation({ operation: mockOperation })

      // Don't advance timers yet
      expect(mockOperation).not.toHaveBeenCalled()

      // Now advance and it should be called
      jest.advanceTimersByTime(1000)

      await promise
      expect(mockOperation).toHaveBeenCalledTimes(1)
    })
  })

  describe('Parameter Validation and Edge Cases', () => {
    it('should use default values when parameters are not provided', async () => {
      const mockOperation = jest.fn().mockResolvedValue('default-params')

      const promise = retryAsyncOperation({ operation: mockOperation })

      jest.advanceTimersByTime(1000) // Default interval

      const result = await promise

      expect(result).toBe('default-params')
    })

    it('should handle operation that returns null', async () => {
      const mockOperation = jest.fn().mockResolvedValue(null)

      const promise = retryAsyncOperation({ operation: mockOperation })

      jest.advanceTimersByTime(1000)

      const result = await promise

      expect(result).toBeNull()
    })

    it('should handle operation that returns undefined', async () => {
      const mockOperation = jest.fn().mockResolvedValue(undefined)

      const promise = retryAsyncOperation({ operation: mockOperation })

      jest.advanceTimersByTime(1000)

      const result = await promise

      expect(result).toBeUndefined()
    })

    it('should handle operation that returns false', async () => {
      const mockOperation = jest.fn().mockResolvedValue(false)

      const promise = retryAsyncOperation({ operation: mockOperation })

      jest.advanceTimersByTime(1000)

      const result = await promise

      expect(result).toBe(false)
    })
  })

  describe('Memory and Resource Management', () => {
    it('should clear interval on successful completion', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success')
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      const promise = retryAsyncOperation({ operation: mockOperation })

      jest.advanceTimersByTime(1000)

      await promise

      expect(clearIntervalSpy).toHaveBeenCalled()
      clearIntervalSpy.mockRestore()
    })

    it('should clear interval on final failure', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Failure'))
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      const promise = retryAsyncOperation({
        operation: mockOperation,
        retries: 1
      })

      jest.advanceTimersByTime(1000)

      try {
        await promise
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
          setTimeout(() => resolve('delayed-success'), 100)
        })
      })

      const promise = retryAsyncOperation({ operation: mockOperation })

      jest.advanceTimersByTime(1000) // Trigger the retry interval
      jest.advanceTimersByTime(100) // Complete the async operation

      const result = await promise

      expect(result).toBe('delayed-success')
    })

    it('should handle async operations that reject asynchronously', async () => {
      const mockOperation = jest
        .fn()
        .mockImplementationOnce(() => {
          return new Promise((_resolve, reject) => {
            setTimeout(() => reject(new Error('delayed-error')), 100)
          })
        })
        .mockResolvedValueOnce('success-after-delay')

      const promise = retryAsyncOperation({ operation: mockOperation })

      jest.advanceTimersByTime(1000) // First attempt
      jest.advanceTimersByTime(100) // Complete the async rejection
      jest.advanceTimersByTime(1000) // Second attempt

      const result = await promise

      expect(result).toBe('success-after-delay')
      expect(mockOperation).toHaveBeenCalledTimes(2)
    })
  })
})
