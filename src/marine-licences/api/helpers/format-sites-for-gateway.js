import { getSiteCoordinates } from '../csv/site-details.js'
import { blobService } from '../../../shared/services/data-service/blob-service.js'
import {
  createLogger,
  structureErrorForECS
} from '../../../shared/common/helpers/logging/logger.js'

const logger = createLogger()

/** 4 hours — short-lived; D365 should treat as ephemeral and re-fetch MAS if needed. */
export const SITE_FILE_PRESIGNED_URL_EXPIRES_IN_SECONDS = 4 * 60 * 60

const WGS84_CRS = {
  type: 'name',
  properties: { name: 'EPSG:4326' }
}

// Display copy for non-taxonomy fields (not FE activity option lists).
// Activity type / subtype / selection labels come only from the LCML document
// as snapshotted by the frontend at save time.
const COMPLETION_DATE_NOT_NEEDED =
  'Not needed to be completed by a certain date'

const LOCATION_METHOD_LABELS = {
  file: 'File upload',
  coordinates: 'Manual coordinate entry'
}

const COORDINATES_ENTRY_LABELS = {
  single: 'Enter a single set of coordinates and a width for a circle',
  multiple:
    'Enter multiple sets of coordinates to mark the boundary of the site'
}

const COORDINATE_SYSTEM_LABELS = {
  wgs84: 'WGS84 (World Geodetic System 1984)',
  osgb36: 'British National Grid (OSGB36)'
}

const FILE_UPLOAD_TYPE_LABELS = {
  kml: 'KML',
  shapefile: 'Shapefile'
}

const YES_NO_LABELS = {
  yes: 'Yes',
  no: 'No'
}

const toSelectionArray = (selections) => {
  if (Array.isArray(selections)) {
    return selections
  }
  return selections ? [selections] : []
}

const parseDurationPart = (value) => (value == null ? 0 : Number(value))

const formatDurationUnit = (value, singular, plural) =>
  `${value} ${value === 1 ? singular : plural}`

const isEmptyActivityDuration = ({ years, months }) =>
  years == null && months == null

const isInvalidActivityDuration = (yearsNumber, monthsNumber) =>
  !Number.isFinite(yearsNumber) ||
  !Number.isFinite(monthsNumber) ||
  (yearsNumber === 0 && monthsNumber === 0)

export const formatActivityDuration = (activityDuration = {}) => {
  if (isEmptyActivityDuration(activityDuration)) {
    return null
  }

  const yearsNumber = parseDurationPart(activityDuration.years)
  const monthsNumber = parseDurationPart(activityDuration.months)

  if (isInvalidActivityDuration(yearsNumber, monthsNumber)) {
    return null
  }

  const yearsPart = formatDurationUnit(yearsNumber, 'year', 'years')
  const monthsPart = formatDurationUnit(monthsNumber, 'month', 'months')

  if (monthsNumber === 0) {
    return yearsPart
  }

  if (yearsNumber === 0) {
    return monthsPart
  }

  return `${yearsPart} ${monthsPart}`
}

export const formatCompletionDateForGateway = (completionDate = {}) => {
  if (!completionDate?.date) {
    return { hasSpecificDate: null, reason: null }
  }

  if (completionDate.date === 'no') {
    return {
      hasSpecificDate: COMPLETION_DATE_NOT_NEEDED,
      reason: null
    }
  }

  return {
    hasSpecificDate: YES_NO_LABELS.yes,
    reason: completionDate.reason ?? null
  }
}

export const formatActivityMonthsForGateway = (activityMonths = {}) => {
  if (!activityMonths?.months) {
    return { applicable: null, details: null }
  }

  return {
    applicable: YES_NO_LABELS[activityMonths.months] ?? null,
    details:
      activityMonths.months === 'yes' ? (activityMonths.details ?? null) : null
  }
}

const ringToPolygonFeature = (ring, siteIndex, siteName) => ({
  type: 'Feature',
  properties: {
    siteIndex,
    siteName: siteName ?? null
  },
  geometry: {
    type: 'Polygon',
    coordinates: [ring]
  }
})

export const buildSiteGeometry = (site, siteIndex) => {
  if (!site) {
    return null
  }

  try {
    if (site.coordinatesType === 'file') {
      if (!site.geoJSON?.features?.length) {
        return null
      }

      return {
        type: 'FeatureCollection',
        crs: WGS84_CRS,
        features: site.geoJSON.features.map((feature) => ({
          type: 'Feature',
          properties: {
            ...(feature.properties || {}),
            siteIndex,
            siteName: site.siteName ?? null
          },
          geometry: feature.geometry
        }))
      }
    }

    const [coords] = getSiteCoordinates([site])
    if (
      !coords?.length ||
      !Array.isArray(coords[0]) ||
      typeof coords[0][0] !== 'number'
    ) {
      return null
    }

    return {
      type: 'FeatureCollection',
      crs: WGS84_CRS,
      features: [ringToPolygonFeature(coords, siteIndex, site.siteName)]
    }
  } catch {
    return null
  }
}

/**
 * Taxonomy display text is taken only from FE-snapshotted fields on the document.
 * Backend does not maintain key→label maps for activity options.
 */
const formatActivityForGateway = (activity, activityIndex) => {
  const selections = toSelectionArray(activity.activities?.selections)
  const subActivities = (activity.activities?.selectionLabels ?? []).filter(
    Boolean
  )

  return {
    activityIndex,
    activityType: activity.activityTypeLabel || null,
    activitySubType: activity.activitySubTypeLabel || null,
    subActivities,
    otherActivity: selections.includes('other')
      ? (activity.activities?.otherActivity ?? null)
      : null,
    activityDescription: activity.activityDescription || null,
    activityDuration: formatActivityDuration(activity.activityDuration),
    activityMonths: formatActivityMonthsForGateway(activity.activityMonths),
    completionDate: formatCompletionDateForGateway(activity.completionDate),
    workingHours: activity.workingHours || null
  }
}

const mintSitePresignedFileUrl = async (site, getPresignedUrl) => {
  if (site.coordinatesType !== 'file') {
    return null
  }

  const s3Bucket = site.s3Location?.s3Bucket
  const s3Key = site.s3Location?.s3Key
  if (!s3Bucket || !s3Key || !getPresignedUrl) {
    return null
  }

  try {
    return await getPresignedUrl(
      s3Bucket,
      s3Key,
      SITE_FILE_PRESIGNED_URL_EXPIRES_IN_SECONDS
    )
  } catch (error) {
    // Prefer a useful MAS payload over failing the whole response.
    const filename = site.uploadedFile?.filename ?? 'unknown'
    logger.error(
      structureErrorForECS(error),
      `MarineLicence:MAS: Failed to generate site file presigned URL for ${s3Bucket} (filename: ${filename})`
    )
    return null
  }
}

const formatUploadedFile = (site, presignedFileUrl = null) => {
  if (site.coordinatesType !== 'file' || !site.uploadedFile?.filename) {
    return null
  }

  return {
    filename: site.uploadedFile.filename,
    fileType:
      FILE_UPLOAD_TYPE_LABELS[site.fileUploadType] ||
      site.fileUploadType ||
      null,
    presignedFileUrl
  }
}

const formatSiteForGateway = (site, siteIndex, presignedFileUrl = null) => ({
  siteIndex,
  siteName: site.siteName ?? null,
  locationMethod: LOCATION_METHOD_LABELS[site.coordinatesType] ?? null,
  coordinatesEntry:
    site.coordinatesType === 'coordinates'
      ? (COORDINATES_ENTRY_LABELS[site.coordinatesEntry] ?? null)
      : null,
  coordinateSystem:
    site.coordinatesType === 'coordinates'
      ? (COORDINATE_SYSTEM_LABELS[site.coordinateSystem] ?? null)
      : null,
  uploadedFile: formatUploadedFile(site, presignedFileUrl),
  circleWidthMetres:
    site.coordinatesEntry === 'single' && site.circleWidth != null
      ? Number(site.circleWidth)
      : null,
  geometry: buildSiteGeometry(site, siteIndex),
  activities: (site.activityDetails ?? []).map(formatActivityForGateway)
})

/**
 * Maps stored siteDetails into the Dynamics MAS sites payload (labels only).
 * Mints short-lived S3 URLs for file-upload sites via getPresignedUrl.
 *
 * @param {Array} siteDetails
 * @param {{ getPresignedUrl?: Function }} [options] inject for tests; defaults to blobService
 */
export const formatSitesForGateway = async (siteDetails = [], options = {}) => {
  if (!Array.isArray(siteDetails)) {
    return []
  }

  const getPresignedUrl =
    options.getPresignedUrl ??
    ((s3Bucket, s3Key, expiresInSeconds) =>
      blobService.getPresignedUrl(s3Bucket, s3Key, expiresInSeconds))

  return Promise.all(
    siteDetails.map(async (site, siteIndex) => {
      const presignedFileUrl = await mintSitePresignedFileUrl(
        site,
        getPresignedUrl
      )
      return formatSiteForGateway(site, siteIndex, presignedFileUrl)
    })
  )
}
