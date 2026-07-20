import { MIN_POINTS_MULTIPLE_COORDINATES } from '../../../shared/common/constants/coordinates.js'
import {
  COMPLETED,
  IN_PROGRESS,
  INCOMPLETE,
  NOT_ACCEPTED,
  buildTaskList,
  getStatusFromRequiredFields
} from '../../../shared/helpers/task-list-utils.js'
import { MARINE_PLAN_POLICY_JOB_STATUS } from '../../constants/marine-licence.js'
import { filterCurrentPolicyResponses } from './marine-plan-policies/filter-policy-responses.js'

const ACTIVITY_DETAILS_FIELDS = [
  'activities',
  'activityType',
  'activitySubType',
  'activityDescription',
  'activityDuration',
  'completionDate',
  'activityMonths',
  'workingHours'
]

const isActivityFieldFilled = (activity, key) => {
  if (key === 'activityMonths') {
    return Boolean(activity.activityMonths?.months)
  }

  if (key === 'completionDate') {
    return Boolean(activity.completionDate?.date)
  }

  return Boolean(activity[key])
}

const checkActivityDetails = (activityDetails) => {
  if (!activityDetails?.length) {
    return IN_PROGRESS
  }

  for (const activity of activityDetails) {
    const filledCount = ACTIVITY_DETAILS_FIELDS.filter((key) =>
      isActivityFieldFilled(activity, key)
    ).length

    if (filledCount < ACTIVITY_DETAILS_FIELDS.length) {
      return IN_PROGRESS
    }
  }

  return COMPLETED
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

const checkSiteDetailsCircle = (siteDetails) => {
  const requiredValues = [
    'coordinateSystem',
    'coordinates',
    'circleWidth',
    'siteName'
  ]

  const siteStatus = getStatusFromRequiredFields(siteDetails, requiredValues)
  const activityStatus = checkActivityDetails(siteDetails.activityDetails)

  if ([siteStatus, activityStatus].every((s) => s === COMPLETED)) {
    return COMPLETED
  }
  return IN_PROGRESS
}

const checkSiteDetailsMultiple = (siteDetails) => {
  const requiredValues = ['coordinateSystem', 'coordinates', 'siteName']

  const missingKeys = requiredValues.filter((key) => !(key in siteDetails))

  if (missingKeys.length === requiredValues.length) {
    return INCOMPLETE
  }

  if (missingKeys.length > 0) {
    return IN_PROGRESS
  }

  const { coordinates } = siteDetails
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < MIN_POINTS_MULTIPLE_COORDINATES
  ) {
    return IN_PROGRESS
  }

  const activityStatus = checkActivityDetails(siteDetails.activityDetails)
  return activityStatus === COMPLETED ? COMPLETED : IN_PROGRESS
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

const validateSite = (site) => {
  const { coordinatesType, coordinatesEntry } = site
  const strategy = getValidationStrategy(coordinatesType, coordinatesEntry)

  if (!strategy) {
    return INCOMPLETE
  }

  return strategy(site)
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

const checkWaterFrameworkDirective = (wfd) => {
  const requiredValues = [
    'nauticalMile',
    'excludedActivities',
    'uploadedFile',
    's3Location'
  ]

  const parsedWfd = Object.fromEntries(
    Object.entries(wfd).filter(([_, value]) => value != null)
  )

  const siteStatus = getStatusFromRequiredFields(parsedWfd, requiredValues)

  if (siteStatus === COMPLETED) {
    return COMPLETED
  }

  return INCOMPLETE
}

const getWaterFrameworkDirectiveStatus = (wfd) => {
  if (!wfd) {
    return INCOMPLETE
  }

  if (wfd.nauticalMile === 'no') {
    return COMPLETED
  }

  if (wfd.excludedActivities === 'yes') {
    return COMPLETED
  }

  return checkWaterFrameworkDirective(wfd)
}

const getFeeEstimateStatus = (feeEstimate) => {
  if (!feeEstimate) {
    return INCOMPLETE
  }

  if (feeEstimate.accept === 'no') {
    return NOT_ACCEPTED
  }

  return COMPLETED
}

const getMarinePlanPolicyStatus = (marineLicence) => {
  if (
    marineLicence.marinePlanPolicyJob !== MARINE_PLAN_POLICY_JOB_STATUS.READY
  ) {
    return INCOMPLETE
  }

  const total = marineLicence.marinePlanPoliciesCount ?? 0
  const { count: completed } = filterCurrentPolicyResponses(
    marineLicence.marinePlanPolicies,
    marineLicence.marinePlanPolicyResponses
  )

  if (completed >= total) {
    return COMPLETED
  }

  if (completed === 0) {
    return INCOMPLETE
  }

  return IN_PROGRESS
}

export const createTaskList = (marineLicence, isCitizen = false) => {
  const tasks = {
    projectName: (value) => (value ? COMPLETED : INCOMPLETE),
    ...(!isCitizen && {
      specialLegalPowers: (value) => (value ? COMPLETED : INCOMPLETE)
    }),
    feeEstimate: (value) => getFeeEstimateStatus(value),
    otherAuthorities: (value) => (value ? COMPLETED : INCOMPLETE),
    harbourAuthority: (value) => (value ? COMPLETED : INCOMPLETE),
    projectBackground: (value) => (value ? COMPLETED : INCOMPLETE),
    siteDetails: (value) => getSiteDetailsStatus(value),
    preferredDates: (value) => (value ? COMPLETED : INCOMPLETE),
    publicConsultation: (value) => (value ? COMPLETED : INCOMPLETE),
    publicRegister: (value) => (value ? COMPLETED : INCOMPLETE),
    waterFrameworkDirective: (value) => getWaterFrameworkDirectiveStatus(value),
    marinePlanPolicies: () => getMarinePlanPolicyStatus(marineLicence)
  }

  return buildTaskList(marineLicence, tasks)
}
