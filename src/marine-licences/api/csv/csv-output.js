export const csvOutput = (coordinates) => {
  const rows = []
  coordinates.forEach((site, index) => {
    site.forEach((coord) => {
      rows.push([
        coord.latDegree,
        coord.latDecMin,
        coord.longDegree,
        coord.longDecMin,
        index
      ])
    })
  })

  return rows
}
