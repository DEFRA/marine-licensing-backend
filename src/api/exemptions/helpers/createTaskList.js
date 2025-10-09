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

const checkSiteDetails = (siteDetails, multipleSitesEnabled) => {
  if (!siteDetails || siteDetails.length === 0) {
    return INCOMPLETE
  }

  let hasInProgress = false

  for (const site of siteDetails) {
    const { coordinatesEntry, coordinatesType } = site
    let validationResult = INCOMPLETE

    if (coordinatesType === 'file') {
      validationResult = checkSiteDetailsFileUpload(site, multipleSitesEnabled)
    }
    if (coordinatesEntry === 'single' && coordinatesType === 'coordinates') {
      validationResult = checkSiteDetailsCircle(site, multipleSitesEnabled)
    }
    if (coordinatesEntry === 'multiple' && coordinatesType === 'coordinates') {
      validationResult = checkSiteDetailsMultiple(site, multipleSitesEnabled)
    }

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
