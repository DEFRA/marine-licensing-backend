export const getProjectStartEndDates = (siteDetails) => {
  const dates = siteDetails?.reduce(
    (acc, site) => {
      const startDate = site.activityDates?.start
      const endDate = site.activityDates?.end

      if (
        startDate &&
        (!acc.start || new Date(startDate) < new Date(acc.start))
      ) {
        acc.start = startDate
      }

      if (endDate && (!acc.end || new Date(endDate) > new Date(acc.end))) {
        acc.end = endDate
      }

      return acc
    },
    { start: null, end: null }
  )

  return dates || { start: null, end: null }
}
