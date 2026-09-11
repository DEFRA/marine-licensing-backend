import { expect } from 'vitest'

export const flushPromises = () =>
  new Promise((resolve) => setTimeout(resolve, 0))

export const expectRecentDate = (value, since) => {
  expect(value).toBeInstanceOf(Date)
  expect(value.getTime()).toBeGreaterThanOrEqual(since)
  expect(value.getTime()).toBeLessThanOrEqual(Date.now())
}
