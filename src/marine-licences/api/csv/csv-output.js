export const csvOutput = (coordinates) => {
  const rows = []
  coordinates.forEach((site, index) => {
    site.forEach((coordinates) => {
      rows.push([
        coordinates.latDegree,
        coordinates.latDecMin,
        coordinates.longDegree,
        coordinates.longDecMin,
        index
      ])
    })
  })

  return rows
}
