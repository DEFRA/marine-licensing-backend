export const COORDINATES_CSV_FILENAME = 'locationForCSV.csv'

export const buildCoordinatesCsvPathById = (id) =>
  `/public/marine-licence/${id}/generate-coordinates-csv`

export const buildCoordinatesCsvUrlById = (backendBaseUrl, id) =>
  `${backendBaseUrl}${buildCoordinatesCsvPathById(id)}`
