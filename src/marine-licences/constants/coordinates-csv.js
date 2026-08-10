export const COORDINATES_CSV_FILENAME = 'locationForCSV.csv'
export const COORDINATES_ZIP_FILENAME = 'Download CSV.zip'

export const buildCoordinatesCsvPathById = (id) =>
  `/public/marine-licence/${id}/generate-coordinates-csv`

export const buildCoordinatesCsvUrlById = (backendGatewayUrl, id) =>
  `${backendGatewayUrl}${buildCoordinatesCsvPathById(id)}`
