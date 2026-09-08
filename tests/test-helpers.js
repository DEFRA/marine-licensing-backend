import { expect } from 'vitest'

export const flushPromises = () =>
  new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Asserts a timestamp was written during the call rather than carried over
 * from the value the document was seeded with. Only meaningful on real
 * timers - under vi.useFakeTimers() the clock is frozen and the window
 * collapses to a single instant.
 */
export const expectRecentDate = (value, since) => {
  expect(value).toBeInstanceOf(Date)
  expect(value.getTime()).toBeGreaterThanOrEqual(since)
  expect(value.getTime()).toBeLessThanOrEqual(Date.now())
}
