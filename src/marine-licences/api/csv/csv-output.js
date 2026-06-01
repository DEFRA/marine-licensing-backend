export const csvOutput = (coordinates) =>
  coordinates.flatMap((site, index) =>
    site.map((coord) => [
      coord.latDegree,
      coord.latDecMin,
      coord.longDegree,
      coord.longDecMin,
      index + 1
    ])
  )
