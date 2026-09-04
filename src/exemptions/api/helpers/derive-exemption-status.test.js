import { deriveExemptionStatus } from './derive-exemption-status.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'

const TODAY = new Date('2026-08-25T00:00:00.000Z')

const siteWith = (start, end) => [
  { activityDates: { start: new Date(start), end: new Date(end) } }
]

describe('deriveExemptionStatus', () => {
  it('is scheduled when the start date is in the future', () => {
    expect(
      deriveExemptionStatus(siteWith('2026-08-26', '2026-09-30'), TODAY)
    ).toBe(EXEMPTION_STATUS.SCHEDULED)
  })

  it('is active on the start date itself', () => {
    expect(
      deriveExemptionStatus(siteWith('2026-08-25', '2026-09-30'), TODAY)
    ).toBe(EXEMPTION_STATUS.ACTIVE)
  })

  it('is active between the start and end dates', () => {
    expect(
      deriveExemptionStatus(siteWith('2026-08-01', '2026-09-30'), TODAY)
    ).toBe(EXEMPTION_STATUS.ACTIVE)
  })

  it('is active on the end date itself, which is inclusive', () => {
    expect(
      deriveExemptionStatus(siteWith('2026-08-01', '2026-08-25'), TODAY)
    ).toBe(EXEMPTION_STATUS.ACTIVE)
  })

  it('is expired the day after the end date', () => {
    expect(
      deriveExemptionStatus(siteWith('2026-08-01', '2026-08-24'), TODAY)
    ).toBe(EXEMPTION_STATUS.EXPIRED)
  })

  it('uses the earliest start across multiple sites', () => {
    const sites = [
      ...siteWith('2026-09-01', '2026-09-30'),
      ...siteWith('2026-08-20', '2026-09-30')
    ]

    expect(deriveExemptionStatus(sites, TODAY)).toBe(EXEMPTION_STATUS.ACTIVE)
  })

  it('uses the latest end across multiple sites', () => {
    const sites = [
      ...siteWith('2026-07-01', '2026-08-24'),
      ...siteWith('2026-07-01', '2026-09-30')
    ]

    expect(deriveExemptionStatus(sites, TODAY)).toBe(EXEMPTION_STATUS.ACTIVE)
  })

  it('returns null when a bound is missing rather than guessing', () => {
    expect(deriveExemptionStatus([{ activityDates: {} }], TODAY)).toBeNull()
    expect(deriveExemptionStatus([], TODAY)).toBeNull()
    expect(deriveExemptionStatus(undefined, TODAY)).toBeNull()
  })
})
