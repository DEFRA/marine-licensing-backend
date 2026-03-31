import { MIN_POINTS_MULTIPLE_COORDINATES } from '../../../shared/common/constants/coordinates.js'
import {
  COMPLETED,
  IN_PROGRESS,
  INCOMPLETE,
  buildTaskList,
  getStatusFromRequiredFields
} from '../../../shared/helpers/task-list-utils.js'

const addConditionalRequiredFields = (
  baseRequiredValues,
  multipleSitesEnabled
) => {
  const requiredValues = [
    ...baseRequiredValues,
    'activityDates',
    'activityDescription'
  ]
  if (multipleSitesEnabled) {
    requiredValues.push('siteName')
  }
  return requiredValues
}

const checkSiteDetailsCircle = (siteDetails, multipleSitesEnabled) => {
  const requiredValues = addConditionalRequiredFields(
    ['coordinateSystem', 'coordinates', 'circleWidth'],
    multipleSitesEnabled
  )

  return getStatusFromRequiredFields(siteDetails, requiredValues)
}

const checkSiteDetailsFileUpload = (siteDetails, multipleSitesEnabled) => {
  const requiredValues = addConditionalRequiredFields(
    ['fileUploadType', 'geoJSON', 'featureCount', 's3Location'],
    multipleSitesEnabled
  )

  return getStatusFromRequiredFields(siteDetails, requiredValues)
}

const checkSiteDetailsMultiple = (siteDetails, multipleSitesEnabled) => {
  const requiredValues = addConditionalRequiredFields(
    ['coordinateSystem', 'coordinates'],
    multipleSitesEnabled
  )

  const missingKeys = requiredValues.filter((key) => !(key in siteDetails))

  if (missingKeys.length === requiredValues.length) {
    return INCOMPLETE
  }

  if (missingKeys.length > 0) {
    return IN_PROGRESS
  }

  // Validate coordinates array has at least 3 points (minimum for polygon)
  const { coordinates } = siteDetails
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < MIN_POINTS_MULTIPLE_COORDINATES
  ) {
    return IN_PROGRESS
  }

  return COMPLETED
}

const getValidationStrategy = (coordinatesType, coordinatesEntry) => {
  if (coordinatesType === 'file') {
    return checkSiteDetailsFileUpload
  }
  if (coordinatesType === 'coordinates' && coordinatesEntry === 'single') {
    return checkSiteDetailsCircle
  }
  if (coordinatesType === 'coordinates' && coordinatesEntry === 'multiple') {
    return checkSiteDetailsMultiple
  }
  return null
}

const validateSite = (site, multipleSitesEnabled) => {
  const { coordinatesEntry, coordinatesType } = site
  const validationStrategy = getValidationStrategy(
    coordinatesType,
    coordinatesEntry
  )

  if (!validationStrategy) {
    return INCOMPLETE
  }

  return validationStrategy(site, multipleSitesEnabled)
}

const getSiteDetailsStatus = (siteDetails, multipleSitesEnabled) => {
  if (!siteDetails || siteDetails.length === 0) {
    return INCOMPLETE
  }

  let hasInProgress = false

  for (const site of siteDetails) {
    const result = validateSite(site, multipleSitesEnabled)
    if (result === INCOMPLETE) {
      return INCOMPLETE
    }
    if (result === IN_PROGRESS) {
      hasInProgress = true
    }
  }

  return hasInProgress ? IN_PROGRESS : COMPLETED
}

export const createTaskList = (exemption) => {
  const multipleSitesEnabled =
    exemption.multipleSiteDetails?.multipleSitesEnabled

  const tasks = {
    publicRegister: (value) => (value ? COMPLETED : INCOMPLETE),
    projectName: (value) => (value ? COMPLETED : INCOMPLETE),
    siteDetails: (value) => getSiteDetailsStatus(value, multipleSitesEnabled)
  }

  return buildTaskList(exemption, tasks)
}
