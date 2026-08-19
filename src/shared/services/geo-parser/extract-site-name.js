const SITE_NAME_MAX_LENGTH = 250

const SITE_NAME_PROPERTY_KEYS_BY_FILE_TYPE = {
  kml: ['name'],
  shapefile: ['site_name', 'sitename', 'name']
}

const getSiteNamePropertyKeys = (fileType) =>
  SITE_NAME_PROPERTY_KEYS_BY_FILE_TYPE[fileType] ??
  SITE_NAME_PROPERTY_KEYS_BY_FILE_TYPE.shapefile

const normaliseSiteName = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value).slice(0, SITE_NAME_MAX_LENGTH)
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  return trimmed.slice(0, SITE_NAME_MAX_LENGTH)
}

const getLowercasedProperties = (properties) => {
  const propertyMap = new Map()

  for (const [key, value] of Object.entries(properties)) {
    propertyMap.set(key.trim().toLowerCase(), value)
  }

  return propertyMap
}

export const extractSiteNameFromProperties = (properties, fileType) => {
  if (!properties || typeof properties !== 'object') {
    return null
  }

  const propertyMap = getLowercasedProperties(properties)

  for (const key of getSiteNamePropertyKeys(fileType)) {
    if (!propertyMap.has(key)) {
      continue
    }

    const siteName = normaliseSiteName(propertyMap.get(key))

    if (siteName) {
      return siteName
    }
  }

  return null
}

export const applyExtractedSiteNames = (geoJSON, fileType) => {
  const features =
    geoJSON?.type === 'FeatureCollection' ? geoJSON.features : [geoJSON]

  if (!Array.isArray(features)) {
    return geoJSON
  }

  for (const feature of features) {
    const siteName = extractSiteNameFromProperties(
      feature?.properties,
      fileType
    )

    if (siteName) {
      feature.properties = { ...feature.properties, name: siteName }
    }
  }

  return geoJSON
}
