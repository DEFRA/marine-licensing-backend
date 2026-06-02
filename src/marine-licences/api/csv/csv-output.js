export const csvOutput = (coordinates, index) =>
  coordinates.flatMap((site) =>
    site.map((coord) => [
      coord.latDegree,
      coord.latDecMin,
      coord.longDegree,
      coord.longDecMin,
      index + 1
    ])
  )
