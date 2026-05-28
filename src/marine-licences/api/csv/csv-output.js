export const csvOutput = (coordinates) => {
  const rows = []

  coordinates.forEach((site, index) => {
    site.forEach((coordinates) => {
      rows.push(['', '', '', '', index])
    })
  })

  return rows
}
