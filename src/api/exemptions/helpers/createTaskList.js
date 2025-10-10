import { MIN_POINTS_MULTIPLE_COORDINATES } from '../../../common/constants/coordinates.js'

export const COMPLETED = 'COMPLETED'
export const IN_PROGRESS = 'IN_PROGRESS'
export const INCOMPLETE = 'INCOMPLETE'

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
    [
      'coordinatesType',
      'coordinatesEntry',
      'coordinateSystem',
      'coordinates',
      'circleWidth'
    ],
    multipleSitesEnabled
  )

  const missingKeys = requiredValues.filter((key) => !(key in siteDetails))

  if (missingKeys.length === 0) {
    return COMPLETED
  }

  if (missingKeys.length === requiredValues.length) {
    return INCOMPLETE
  }

  return IN_PROGRESS
}

const checkSiteDetailsFileUpload = (siteDetails, multipleSitesEnabled) => {
  const requiredValues = addConditionalRequiredFields(
    [
      'coordinatesType',
      'fileUploadType',
      'geoJSON',
      'featureCount',
      's3Location'
    ],
    multipleSitesEnabled
  )

  const missingKeys = requiredValues.filter((key) => !(key in siteDetails))

  if (missingKeys.length === 0) {
    return COMPLETED
  }

  if (missingKeys.length === requiredValues.length) {
    return INCOMPLETE
  }

  return IN_PROGRESS
}

const checkSiteDetailsMultiple = (siteDetails, multipleSitesEnabled) => {
  const requiredValues = addConditionalRequiredFields(
    ['coordinatesType', 'coordinatesEntry', 'coordinateSystem', 'coordinates'],
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
    return 'fileUpload'
  }
  if (coordinatesType === 'coordinates' && coordinatesEntry === 'single') {
    return 'circle'
  }
  if (coordinatesType === 'coordinates' && coordinatesEntry === 'multiple') {
    return 'multiple'
  }
  return null
}

const validateSite = (site, multipleSitesEnabled) => {
  const { coordinatesEntry, coordinatesType } = site
  const strategy = getValidationStrategy(coordinatesType, coordinatesEntry)

  if (!strategy) {
    return INCOMPLETE
  }

  const validationStrategies = {
    fileUpload: checkSiteDetailsFileUpload,
    circle: checkSiteDetailsCircle,
    multiple: checkSiteDetailsMultiple
  }

  const validator = validationStrategies[strategy]
  return validator(site, multipleSitesEnabled)
}

const checkSiteDetails = (siteDetails, multipleSitesEnabled) => {
  if (!siteDetails || siteDetails.length === 0) {
    return INCOMPLETE
  }

  let hasInProgress = false

  for (const site of siteDetails) {
    const validationResult = validateSite(site, multipleSitesEnabled)

    if (validationResult === INCOMPLETE) {
      return INCOMPLETE
    }

    if (validationResult === IN_PROGRESS) {
      hasInProgress = true
    }
  }

  return hasInProgress ? IN_PROGRESS : COMPLETED
}

export const createTaskList = (exemption) => {
  const tasks = {
    publicRegister: (value) => (value ? COMPLETED : INCOMPLETE),
    activityDates: (value) => (value ? COMPLETED : INCOMPLETE),
    projectName: (value) => (value ? COMPLETED : INCOMPLETE),
    siteDetails: (value) =>
      checkSiteDetails(
        value,
        exemption.multipleSiteDetails?.multipleSitesEnabled
      ),
    activityDescription: (value) => (value ? COMPLETED : INCOMPLETE)
  }

  const taskList = {}

  Object.entries(tasks).forEach(([taskName, decideStatus]) => {
    const status = decideStatus(exemption[taskName])
    if (status && status !== INCOMPLETE) {
      taskList[taskName] = status
    }
  })

  return taskList
}
