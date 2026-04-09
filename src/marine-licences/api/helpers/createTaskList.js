import {
  COMPLETED,
  IN_PROGRESS,
  INCOMPLETE,
  buildTaskList,
  getStatusFromRequiredFields
} from '../../../shared/helpers/task-list-utils.js'

const ACTIVITY_DETAILS_FIELDS = [
  'activityType',
  'activityDescription',
  'activityDuration',
  'completionDate',
  'activityMonths',
  'workingHours'
]

const checkActivityDetails = (activityDetails) => {
  const filledCount = ACTIVITY_DETAILS_FIELDS.filter(
    (key) => activityDetails[0][key]
  ).length

  if (filledCount === ACTIVITY_DETAILS_FIELDS.length) {
    return COMPLETED
  }

  return IN_PROGRESS
}

const checkSiteDetailsFileUpload = (siteDetails) => {
  const requiredValues = [
    'fileUploadType',
    'geoJSON',
    'featureCount',
    's3Location',
    'siteName'
  ]

  const siteStatus = getStatusFromRequiredFields(siteDetails, requiredValues)
  const activityStatus = checkActivityDetails(siteDetails.activityDetails)

  if ([siteStatus, activityStatus].every((s) => s === COMPLETED)) {
    return COMPLETED
  }
  return IN_PROGRESS
}

const validateSite = (site) => {
  const { coordinatesType } = site

  if (coordinatesType !== 'file') {
    return INCOMPLETE
  }

  return checkSiteDetailsFileUpload(site)
}

const getSiteDetailsStatus = (siteDetails) => {
  if (!siteDetails || siteDetails.length === 0) {
    return INCOMPLETE
  }

  let hasInProgress = false

  for (const site of siteDetails) {
    const result = validateSite(site)
    if (result === INCOMPLETE) {
      return INCOMPLETE
    }
    if (result === IN_PROGRESS) {
      hasInProgress = true
    }
  }

  return hasInProgress ? IN_PROGRESS : COMPLETED
}

export const createTaskList = (marineLicence, isCitizen = false) => {
  const tasks = {
    projectName: (value) => (value ? COMPLETED : INCOMPLETE),
    ...(!isCitizen && {
      specialLegalPowers: (value) => (value ? COMPLETED : INCOMPLETE)
    }),
    siteDetails: (value) => getSiteDetailsStatus(value),
    otherAuthorities: (value) => (value ? COMPLETED : INCOMPLETE)
  }

  return buildTaskList(marineLicence, tasks)
}
