import { stringify } from 'csv-stringify'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { ObjectId } from 'mongodb'

const csvHeaders = [
  'Lat Degree',
  'Lat Dec Min',
  'Long Degree',
  'Long Dec Min',
  'objectid'
]

export const generateCoordinatesCsvController = {
  handler: async (request, h) => {
    const { params, db } = request

    const marineLicenceCursor = db
      .collection(collectionMarineLicences)
      .find({ _id: ObjectId.createFromHexString(params.id) })
      .stream()

    const stream = stringify({ header: true, columns: csvHeaders })

    marineLicenceCursor.on('data', (doc) => {
      stream.write(doc)
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
