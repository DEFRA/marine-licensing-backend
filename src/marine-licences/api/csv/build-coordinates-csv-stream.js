import { Transform } from 'node:stream'
import { stringify } from 'csv-stringify'
import { getSiteCoordinates } from './site-details.js'
import { convertCoordinatesToDdm } from './coordinates-to-ddm.js'
import { csvOutput } from './csv-output.js'
import { coordinatesToCsvObject } from './coordinates-to-csv.js'
import { COORDINATES_CSV_FILENAME } from '../../constants/coordinates-csv.js'

const csvHeaders = [
  'Lat Degree',
  'Lat Dec Min',
  'Long Degree',
  'Long Dec Min',
  'objectid'
]

export const buildCoordinatesCsvStream = (siteDetails) => {
  const csvStream = stringify({ header: true, columns: csvHeaders })

  const siteTransform = new Transform({
    objectMode: true,
    transform([index, site], _, callback) {
      const coords = getSiteCoordinates([site])
      const ddm = convertCoordinatesToDdm(coords)
      const csvObjects = coordinatesToCsvObject(ddm)
      for (const row of csvOutput(csvObjects, index)) {
        this.push(row)
      }
      callback()
    }
  })

  siteTransform.pipe(csvStream)

  for (const entry of (siteDetails ?? []).entries()) {
    siteTransform.write(entry)
  }
  siteTransform.end()

  return csvStream
}

export const coordinatesCsvResponse = (h, csvStream) =>
  h
    .response(csvStream)
    .type('text/csv')
    .header(
      'Content-Disposition',
      `attachment; filename="${COORDINATES_CSV_FILENAME}"`
    )
