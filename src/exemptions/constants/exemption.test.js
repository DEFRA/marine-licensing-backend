import {
  EXEMPTION_STATUS,
  EXEMPTION_STATUS_LABEL,
  SUBMITTED_STATUSES,
  WITHDRAWABLE_STATUSES
} from './exemption.js'

describe('exemption status constants', () => {
  it('every status has a display label', () => {
    for (const status of Object.values(EXEMPTION_STATUS)) {
      expect(EXEMPTION_STATUS_LABEL[status]).toBeDefined()
    }
  })

  it('submitted statuses are the three date-derived ones', () => {
    expect(SUBMITTED_STATUSES).toEqual([
      EXEMPTION_STATUS.SCHEDULED,
      EXEMPTION_STATUS.ACTIVE,
      EXEMPTION_STATUS.EXPIRED
    ])
  })

  it('excludes draft and withdrawn from submitted statuses', () => {
    expect(SUBMITTED_STATUSES).not.toContain(EXEMPTION_STATUS.DRAFT)
    expect(SUBMITTED_STATUSES).not.toContain(EXEMPTION_STATUS.WITHDRAWN)
  })

  it('an expired exemption cannot be withdrawn', () => {
    expect(WITHDRAWABLE_STATUSES).not.toContain(EXEMPTION_STATUS.EXPIRED)
    expect(WITHDRAWABLE_STATUSES).toEqual([
      EXEMPTION_STATUS.SCHEDULED,
      EXEMPTION_STATUS.ACTIVE
    ])
  })
})
