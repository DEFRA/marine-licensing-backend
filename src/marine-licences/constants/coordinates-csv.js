export const COORDINATES_CSV_FILENAME = 'locationForCSV.csv'

export const buildCoordinatesCsvPathByReference = (applicationReference) =>
  `/public/marine-licence/${encodeURIComponent(applicationReference)}/generate-coordinates-csv`

export const buildCoordinatesCsvUrlByReference = (
  backendBaseUrl,
  applicationReference
) =>
  `${backendBaseUrl}${buildCoordinatesCsvPathByReference(applicationReference)}`
