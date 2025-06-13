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

const checkSiteDetails = (siteDetails) => {
  if (!siteDetails || !Object.keys(siteDetails).length) {
    return null
  }

  const { coordinatesEntry, coordinatesType } = siteDetails

  if (coordinatesEntry === 'single' && coordinatesType === 'coordinates') {
    return checkSiteDetailsCircle(siteDetails)
  }

  return null
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
