import {
  COORDINATES_CSV_FILENAME,
  COORDINATES_ZIP_FILENAME,
  buildCoordinatesCsvPathById,
  buildCoordinatesCsvUrlById
} from './coordinates-csv.js'

describe('coordinates-csv constants', () => {
  it('exposes the CSV and ZIP filenames', () => {
    expect(COORDINATES_CSV_FILENAME).toBe('locationForCSV.csv')
    expect(COORDINATES_ZIP_FILENAME).toBe('Download CSV.zip')
  })

  it('builds a path with the marine licence id', () => {
    expect(buildCoordinatesCsvPathById('507f1f77bcf86cd799439011')).toBe(
      '/public/marine-licence/507f1f77bcf86cd799439011/generate-coordinates-csv'
    )
  })

  it('builds an absolute coordinates CSV URL', () => {
    expect(
      buildCoordinatesCsvUrlById(
        'https://api.example.com',
        '507f1f77bcf86cd799439011'
      )
    ).toBe(
      'https://api.example.com/public/marine-licence/507f1f77bcf86cd799439011/generate-coordinates-csv'
    )
  })
})
