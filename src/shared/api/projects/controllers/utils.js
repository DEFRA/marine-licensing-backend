import {
  collectionExemptions,
  collectionMarineLicences
} from '../../../common/constants/db-collections.js'
import { createLogger } from '../../../common/helpers/logging/logger.js'

const logger = createLogger()
const logSystem = 'Projects:GetProjects'

export const getStatusFilter = (status) => {
  if (!status) {
    return {}
  }

  return {
    status: {
      $in: status
    }
  }
}

export const queryEmployeeCollections = async (db, orgFilter, type) => {
  const requestingExemptions = !type || type.includes('exemptions')
  const requestingMarineLicences = !type || type.includes('marine-licence')

  const dbStartedAt = Date.now()

  const [empExemptions, empMarineLicences] = await Promise.all([
    requestingExemptions
      ? db
          .collection(collectionExemptions)
          .find(orgFilter)
          .sort({ projectName: 1 })
          .toArray()
      : Promise.resolve([]),
    requestingMarineLicences
      ? db
          .collection(collectionMarineLicences)
          .find(orgFilter)
          .sort({ projectName: 1 })
          .toArray()
      : Promise.resolve([])
  ])

  logger.info(
    `${logSystem}: Employee projects database query completed in ${Date.now() - dbStartedAt}ms (exemptions: ${empExemptions.length}, marineLicences: ${empMarineLicences.length})`
  )

  return [empExemptions, empMarineLicences]
}
