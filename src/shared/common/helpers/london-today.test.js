import { londonToday } from './london-today.js'

describe('londonToday', () => {
  it('uses the London calendar day during British Summer Time', () => {
    // 23:30 UTC in August is already the next day in London
    const result = londonToday(new Date('2026-08-24T23:30:00.000Z'))

    expect(result.toISOString()).toBe('2026-08-25T00:00:00.000Z')
  })

  it('uses the UTC calendar day outside British Summer Time', () => {
    const result = londonToday(new Date('2026-01-24T23:30:00.000Z'))

    expect(result.toISOString()).toBe('2026-01-24T00:00:00.000Z')
  })

  it('normalises to midnight so it compares against stored dates directly', () => {
    const result = londonToday(new Date('2026-06-15T14:37:12.345Z'))

    expect(result.toISOString()).toBe('2026-06-15T00:00:00.000Z')
  })

  it('zero-pads single-digit months and days', () => {
    const result = londonToday(new Date('2026-03-05T12:00:00.000Z'))

    expect(result.toISOString()).toBe('2026-03-05T00:00:00.000Z')
  })
})
