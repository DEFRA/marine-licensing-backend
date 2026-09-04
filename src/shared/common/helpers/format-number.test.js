import { formatNumber } from './format-number.js'

describe('formatNumber', () => {
  it('leaves numbers below a thousand unchanged', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(999)).toBe('999')
  })

  it('separates thousands so log lines stay readable', () => {
    expect(formatNumber(1000)).toBe('1,000')
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('formats a duration the same way as a count', () => {
    expect(formatNumber(12000)).toBe('12,000')
  })
})
