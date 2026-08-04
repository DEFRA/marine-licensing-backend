import { getSiteCoordinates } from '../csv/site-details.js'

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
  coordinates: 'Enter the coordinates of the site manually'
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

export const formatActivityDuration = (activityDuration = {}) => {
  const years = activityDuration.years
  const months = activityDuration.months

  if (years == null && months == null) {
    return null
  }

  const yearsNumber = years == null ? 0 : Number(years)
  const monthsNumber = months == null ? 0 : Number(months)

  if (
    !Number.isFinite(yearsNumber) ||
    !Number.isFinite(monthsNumber) ||
    (yearsNumber === 0 && monthsNumber === 0)
  ) {
    return null
  }

  const yearLabel = yearsNumber === 1 ? 'year' : 'years'
  const monthLabel = monthsNumber === 1 ? 'month' : 'months'

  if (monthsNumber === 0) {
    return `${yearsNumber} ${yearLabel}`
  }

  if (yearsNumber === 0) {
    return `${monthsNumber} ${monthLabel}`
  }

  return `${yearsNumber} ${yearLabel} ${monthsNumber} ${monthLabel}`
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

const ringToPolygonFeature = (ring, siteIndex, siteName) => {
  if (!Array.isArray(ring) || ring.length === 0) {
    return null
  }

  return {
    type: 'Feature',
    properties: {
      siteIndex,
      siteName: siteName ?? null
    },
    geometry: {
      type: 'Polygon',
      coordinates: [ring]
    }
  }
}

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
    if (!coords?.length) {
      return null
    }

    if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
      const feature = ringToPolygonFeature(coords, siteIndex, site.siteName)
      if (!feature) {
        return null
      }
      return {
        type: 'FeatureCollection',
        crs: WGS84_CRS,
        features: [feature]
      }
    }

    return null
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

const formatUploadedFile = (site) => {
  if (site.coordinatesType !== 'file' || !site.uploadedFile?.filename) {
    return null
  }

  return {
    filename: site.uploadedFile.filename,
    fileType:
      FILE_UPLOAD_TYPE_LABELS[site.fileUploadType] ||
      site.fileUploadType ||
      null
  }
}

const formatSiteForGateway = (site, siteIndex) => ({
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
  uploadedFile: formatUploadedFile(site),
  circleWidthMetres:
    site.coordinatesEntry === 'single' && site.circleWidth != null
      ? Number(site.circleWidth)
      : null,
  geometry: buildSiteGeometry(site, siteIndex),
  activities: (site.activityDetails ?? []).map(formatActivityForGateway)
})

/**
 * Maps stored siteDetails into the Dynamics MAS sites payload (labels only).
 */
export const formatSitesForGateway = (siteDetails = []) => {
  if (!Array.isArray(siteDetails)) {
    return []
  }

  return siteDetails.map(formatSiteForGateway)
}
