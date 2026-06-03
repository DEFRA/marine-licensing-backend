const parseDdm = (ddmString) => {
  const [degrees, minutesAndDirection] = ddmString.split('° ')
  const [decimalMinutes] = minutesAndDirection.split("' ")
  return { degrees: Number(degrees), decimalMinutes: Number(decimalMinutes) }
}

const pointToCsvRow = ({ lat, lon }) => {
  const latParsed = parseDdm(lat)
  const lonParsed = parseDdm(lon)
  return {
    latDegree: latParsed.degrees,
    latDecMin: latParsed.decimalMinutes,
    longDegree: lonParsed.degrees,
    longDecMin: lonParsed.decimalMinutes
  }
}

/**
 * Converts DDM coordinates to CSV row objects.
 * All site types produce: [{ latDegree, latDecMin, longDegree, longDecMin }, ...]
 */
export const coordinatesToCsvObject = (siteCoordinates) =>
  siteCoordinates.map((site) => site.map(pointToCsvRow))
