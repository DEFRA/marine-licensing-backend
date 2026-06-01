import { Transform } from 'node:stream'
import { stringify } from 'csv-stringify'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { ObjectId } from 'mongodb'
import { isEntraIdUser } from '../../../shared/helpers/is-entra-id-user.js'
import Boom from '@hapi/boom'
import { getSiteCoordinates } from '../csv/site-details.js'
import { convertCoordinatesToDdm } from '../csv/coordinates-to-ddm.js'
import { csvOutput } from '../csv/csv-output.js'
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

    const doc = await db
      .collection(collectionMarineLicences)
      .findOne(
        { _id: ObjectId.createFromHexString(params.id) },
        { projection: { siteDetails: 1 } }
      )

    if (!doc) {
      throw Boom.notFound('Marine licence not found')
    }

    const csvStream = stringify({ header: true, columns: csvHeaders })

    const siteTransform = new Transform({
      objectMode: true,
      transform([_index, site], _, callback) {
        const coords = getSiteCoordinates([site])
        const ddm = convertCoordinatesToDdm(coords)
        const csvObjects = coordinatesToCsvObject(ddm)
        for (const row of csvOutput(csvObjects)) {
          this.push(row)
        }
        callback()
      }
    })

    siteTransform.pipe(csvStream)

    for (const entry of (doc.siteDetails ?? []).entries()) {
      siteTransform.write(entry)
    }
    siteTransform.end()

    return h
      .response(csvStream)
      .type('text/csv')
      .header(
        'Content-Disposition',
        'attachment; filename="locationForCSV.csv"'
      )
  }
}
