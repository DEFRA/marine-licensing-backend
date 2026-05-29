import { stringify } from 'csv-stringify'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { ObjectId } from 'mongodb'
import { isEntraIdUser } from '../../../shared/helpers/is-entra-id-user.js'
import Boom from '@hapi/boom'
import { getSiteCoordinates } from '../csv/site-details.js'
import { convertCoordinatesToDdm } from '../csv/coordinates-to-ddm.js'
import { csvOutput } from '../csv/csv-output.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'
import { coordinatesToCsvObject } from '../csv/coordinates-to-csv.js'

const csvHeaders = [
  'Lat Degree',
  'Lat Dec Min',
  'Long Degree',
  'Long Dec Min',
  'objectid'
]

export const generateCoordinatesCsvController = {
  handler: async (request, h) => {
    const isUserEntraIdUser = isEntraIdUser(request)

    if (!isUserEntraIdUser) {
      throw Boom.forbidden('Not authorised to view CSV data')
    }

    const { params, db } = request

    const stream = stringify({ header: true, columns: csvHeaders })
    const marineLicenceCursor = db
      .collection(collectionMarineLicences)
      .find({ _id: ObjectId.createFromHexString(params.id) })
      .stream()

    marineLicenceCursor.on('data', (doc) => {
      try {
        const coordinates = getSiteCoordinates(doc.siteDetails)
        const ddmCoordinates = convertCoordinatesToDdm(coordinates)
        const parsedDdmCoordinates = coordinatesToCsvObject(ddmCoordinates)
        const csvData = csvOutput(parsedDdmCoordinates)
        csvData.forEach((row) => stream.write(row))
      } catch (err) {
        request.logger.error(
          structureErrorForECS(err),
          `Failed to output CSV file`
        )
        stream.destroy(err)
      }
    })

    marineLicenceCursor.on('end', () => stream.end())
    marineLicenceCursor.on('error', (err) => stream.destroy(err))

    return h
      .response(stream)
      .type('text/csv')
      .header(
        'Content-Disposition',
        'attachment; filename="locationForCSV.csv"'
      )
  }
}
