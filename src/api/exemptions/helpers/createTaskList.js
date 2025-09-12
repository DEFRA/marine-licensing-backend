import { MIN_POINTS_MULTIPLE_COORDINATES } from '../../../common/constants/coordinates.js'
export const COMPLETED = 'COMPLETED'

const checkSiteDetailsCircle = (siteDetails) => {
  const requiredValues = [
    'coordinatesType',
    'coordinatesEntry',
    'coordinateSystem',
    'coordinates',
    'circleWidth'
  ]
  const missingKeys = requiredValues.filter((key) => !(key in siteDetails))

  return missingKeys.length === 0 ? COMPLETED : null
}

const checkSiteDetailsFileUpload = (siteDetails) => {
  const requiredValues = [
    'coordinatesType',
    'fileUploadType',
    'geoJSON',
    'featureCount',
    's3Location'
  ]
  const missingKeys = requiredValues.filter((key) => !(key in siteDetails))

  return missingKeys.length === 0 ? COMPLETED : null
}

const checkSiteDetailsMultiple = (siteDetails) => {
  const requiredValues = [
    'coordinatesType',
    'coordinatesEntry',
    'coordinateSystem',
    'coordinates'
  ]
  const missingKeys = requiredValues.filter((key) => !(key in siteDetails))

  if (missingKeys.length > 0) {
    return null
  }

  // Validate coordinates array has at least 3 points (minimum for polygon)
  const { coordinates } = siteDetails
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < MIN_POINTS_MULTIPLE_COORDINATES
  ) {
    return null
  }

  return COMPLETED
}

const checkSiteDetails = (siteDetails) => {
  if (!siteDetails || siteDetails.length === 0) {
    return null
  }

  for (const site of siteDetails) {
    const { coordinatesEntry, coordinatesType } = site
    let validationResult = null

    if (coordinatesType === 'file') {
      validationResult = checkSiteDetailsFileUpload(site)
    }
    if (coordinatesEntry === 'single' && coordinatesType === 'coordinates') {
      validationResult = checkSiteDetailsCircle(site)
    }
    if (coordinatesEntry === 'multiple' && coordinatesType === 'coordinates') {
      validationResult = checkSiteDetailsMultiple(site)
    }

    if (validationResult === null) {
      return null
    }
  }

  return COMPLETED
}

export const createTaskList = (exemption) => {
  const tasks = {
    publicRegister: (value) => (value ? COMPLETED : null),
    activityDates: (value) => (value ? COMPLETED : null),
    projectName: (value) => (value ? COMPLETED : null),
    siteDetails: (value) => checkSiteDetails(value),
    activityDescription: (value) => (value ? COMPLETED : null)
  }

  const taskList = {}

  Object.entries(tasks).forEach(([taskName, decideStatus]) => {
    const status = decideStatus(exemption[taskName])
    if (status) {
      taskList[taskName] = status
    }
  })

  return taskList
}
