import {
  COMPLETED,
  IN_PROGRESS,
  INCOMPLETE,
  buildTaskList,
  getStatusFromRequiredFields
} from '../../../shared/helpers/task-list-utils.js'

export { COMPLETED, IN_PROGRESS, INCOMPLETE }

const checkSiteDetailsFileUpload = (siteDetails) => {
  const requiredValues = [
    'fileUploadType',
    'geoJSON',
    'featureCount',
    's3Location',
    'siteName'
  ]

  return getStatusFromRequiredFields(siteDetails, requiredValues)
}

const validateSite = (site) => {
  const { coordinatesType } = site

  if (coordinatesType !== 'file') {
    return INCOMPLETE
  }

  return checkSiteDetailsFileUpload(site)
}

const getSiteDetailsStatus = (siteDetails) => {
  if (!siteDetails || siteDetails.length === 0) return INCOMPLETE

  let hasInProgress = false

  for (const site of siteDetails) {
    const result = validateSite(site)
    if (result === INCOMPLETE) return INCOMPLETE
    if (result === IN_PROGRESS) hasInProgress = true
  }

  return hasInProgress ? IN_PROGRESS : COMPLETED
}

export const createTaskList = (marineLicence, isCitizen = false) => {
  const tasks = {
    projectName: (value) => (value ? COMPLETED : INCOMPLETE),
    ...(!isCitizen && {
      specialLegalPowers: (value) => (value ? COMPLETED : INCOMPLETE)
    }),
    siteDetails: getSiteDetailsStatus
  }

  return buildTaskList(marineLicence, tasks)
}
