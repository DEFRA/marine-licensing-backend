import { getProjectStartEndDates } from './get-project-start-end-dates.js'

describe('getProjectStartEndDates', () => {
  it('should return the earliest start date and latest end date from multiple sites', () => {
    const siteDetails = [
      {
        activityDates: {
          start: '2024-03-15T00:00:00.000Z',
          end: '2024-06-15T00:00:00.000Z'
        }
      },
      {
        activityDates: {
          start: '2024-01-10T00:00:00.000Z',
          end: '2024-08-20T00:00:00.000Z'
        }
      },
      {
        activityDates: {
          start: '2024-02-01T00:00:00.000Z',
          end: '2024-05-30T00:00:00.000Z'
        }
      }
    ]

    const result = getProjectStartEndDates(siteDetails)
    expect(result).toEqual({
      start: '2024-01-10T00:00:00.000Z',
      end: '2024-08-20T00:00:00.000Z'
    })
  })

  it('should handle sites with only start dates', () => {
    const siteDetails = [
      {
        activityDates: {
          start: '2024-03-15T00:00:00.000Z'
        }
      },
      {
        activityDates: {
          start: '2024-01-10T00:00:00.000Z'
        }
      }
    ]

    const result = getProjectStartEndDates(siteDetails)
    expect(result).toEqual({
      start: '2024-01-10T00:00:00.000Z',
      end: null
    })
  })

  it('should handle sites with only end dates', () => {
    const siteDetails = [
      {
        activityDates: {
          end: '2024-06-15T00:00:00.000Z'
        }
      },
      {
        activityDates: {
          end: '2024-08-20T00:00:00.000Z'
        }
      }
    ]

    const result = getProjectStartEndDates(siteDetails)
    expect(result).toEqual({
      start: null,
      end: '2024-08-20T00:00:00.000Z'
    })
  })

  it('should handle sites with no activityDates', () => {
    const siteDetails = [{ name: 'Site 1' }, { name: 'Site 2' }]

    const result = getProjectStartEndDates(siteDetails)
    expect(result).toEqual({
      start: null,
      end: null
    })
  })

  it('should handle sites with empty activityDates', () => {
    const siteDetails = [{ activityDates: {} }, { activityDates: {} }]

    const result = getProjectStartEndDates(siteDetails)
    expect(result).toEqual({
      start: null,
      end: null
    })
  })

  it('should handle empty array', () => {
    const siteDetails = []

    const result = getProjectStartEndDates(siteDetails)
    expect(result).toEqual({
      start: null,
      end: null
    })
  })

  it('should handle null input', () => {
    const result = getProjectStartEndDates(null)
    expect(result).toEqual({
      start: null,
      end: null
    })
  })

  it('should handle undefined input', () => {
    const result = getProjectStartEndDates(undefined)
    expect(result).toEqual({
      start: null,
      end: null
    })
  })

  it('should handle single site', () => {
    const siteDetails = [
      {
        activityDates: {
          start: '2024-03-15T00:00:00.000Z',
          end: '2024-06-15T00:00:00.000Z'
        }
      }
    ]

    const result = getProjectStartEndDates(siteDetails)
    expect(result).toEqual({
      start: '2024-03-15T00:00:00.000Z',
      end: '2024-06-15T00:00:00.000Z'
    })
  })

  it('should handle mixed sites with some having dates and some not', () => {
    const siteDetails = [
      {
        activityDates: {
          start: '2024-03-15T00:00:00.000Z',
          end: '2024-06-15T00:00:00.000Z'
        }
      },
      { name: 'Site without dates' },
      {
        activityDates: {
          start: '2024-01-10T00:00:00.000Z'
        }
      }
    ]

    const result = getProjectStartEndDates(siteDetails)
    expect(result).toEqual({
      start: '2024-01-10T00:00:00.000Z',
      end: '2024-06-15T00:00:00.000Z'
    })
  })

  it('should handle dates that are the same', () => {
    const siteDetails = [
      {
        activityDates: {
          start: '2024-03-15T00:00:00.000Z',
          end: '2024-06-15T00:00:00.000Z'
        }
      },
      {
        activityDates: {
          start: '2024-03-15T00:00:00.000Z',
          end: '2024-06-15T00:00:00.000Z'
        }
      }
    ]

    const result = getProjectStartEndDates(siteDetails)
    expect(result).toEqual({
      start: '2024-03-15T00:00:00.000Z',
      end: '2024-06-15T00:00:00.000Z'
    })
  })
})
