import { Transform } from 'node:stream'
import { stringify } from 'csv-stringify'
import AdmZip from 'adm-zip'
import { getSiteCoordinates } from './site-details.js'
import { convertCoordinatesToDdm } from './coordinates-to-ddm.js'
import { csvOutput } from './csv-output.js'
import { coordinatesToCsvObject } from './coordinates-to-csv.js'
import {
  COORDINATES_CSV_FILENAME,
  COORDINATES_ZIP_FILENAME
} from '../../constants/coordinates-csv.js'

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

const formatCsvName = (site, index) => {
  return `${site.siteName ?? `Site ${index + 1}`}.csv`
}

const bufferCsvStream = async (csvStream) => {
  const chunks = await csvStream.toArray()
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
}

const buildCoordinatesZip = async (csvStream, siteDetails) => {
  const zip = new AdmZip()
  const csvBuffer = await bufferCsvStream(csvStream)

  const isSingleSite = siteDetails.length === 1

  zip.addFile(
    isSingleSite ? formatCsvName(siteDetails[0], 0) : COORDINATES_CSV_FILENAME,
    csvBuffer
  )

  if (isSingleSite) {
    return zip
  }

  for (const [index, site] of siteDetails.entries()) {
    const siteBuffer = await bufferCsvStream(buildCoordinatesCsvStream([site]))
    zip.addFile(formatCsvName(site, index), siteBuffer)
  }

  return zip
}

export const coordinatesCsvResponse = async (h, csvStream, siteDetails) => {
  const zip = await buildCoordinatesZip(csvStream, siteDetails)

  return h
    .response(zip.toBuffer())
    .type('application/zip')
    .header(
      'Content-Disposition',
      `attachment; filename="${COORDINATES_ZIP_FILENAME}"`
    )
}
