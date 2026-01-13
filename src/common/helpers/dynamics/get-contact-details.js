import Wreck from '@hapi/wreck'
import { createLogger, structureErrorForECS } from '../logging/logger.js'
import { getDynamicsAccessToken } from './get-access-token.js'
import { retryAsyncOperation } from '../retry-async-operation.js'
import { config } from '../../../config.js'

const logger = createLogger()

const isValidGuid = (guid) => {
  const guidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return guidRegex.test(guid)
}

const escapeODataString = (str) => {
  return String(str).replaceAll("'", "''")
}

const dynamicsHeaders = (accessToken) => ({
  Authorization: `Bearer ${accessToken}`,
  Accept: 'application/json',
  'OData-Version': '4.0',
  'OData-MaxVersion': '4.0'
})

const parseResponse = (response) => {
  const jsonString = Buffer.from(response.payload).toString('utf8')
  return JSON.parse(jsonString)
}

const filterValidContactIds = (contactIds) => {
  const uniqueIds = [...new Set(contactIds)]

  return uniqueIds.filter((id) => {
    if (!id) {
      logger.warn('Empty contact ID provided')
      return false
    }
    if (!isValidGuid(id)) {
      logger.warn(`Invalid contact ID format: ${id}`)
      return false
    }
    return true
  })
}

const fetchContactBatch = async (batchIds, baseUrl) => {
  const accessToken = await getDynamicsAccessToken({ type: 'contactDetails' })

  const filterClauses = batchIds
    .map((id) => `contactid eq '${escapeODataString(id)}'`)
    .join(' or ')
  const endpoint = `${baseUrl}/contacts?$select=fullname,contactid&$filter=${filterClauses}`

  const response = await Wreck.get(endpoint, {
    headers: dynamicsHeaders(accessToken)
  })

  const parsedData = parseResponse(response)
  const contacts = parsedData.value || []

  return contacts.reduce((map, contact) => {
    map[contact.contactid] = contact.fullname || '-'
    return map
  }, {})
}

export const getContactNameById = async ({ contactId }) => {
  if (!isValidGuid(contactId)) {
    logger.warn(`Invalid contact ID format in getContactNameById: ${contactId}`)
    return null
  }

  logger.info(`Dynamics contact details requested for ID ${contactId}`)
  try {
    const {
      contactDetails: { apiUrl },
      isDynamicsEnabled
    } = config.get('dynamics')
    if (!isDynamicsEnabled) {
      return null
    }
    const endpoint = apiUrl.replace('{{contactId}}', contactId)
    const accessToken = await getDynamicsAccessToken({ type: 'contactDetails' })
    const response = await Wreck.get(endpoint, {
      headers: dynamicsHeaders(accessToken)
    })
    const { fullname } = parseResponse(response)
    return fullname
  } catch (err) {
    logger.error(
      structureErrorForECS(err),
      `Error - Dynamics contact details request for ID ${contactId}`
    )
    return null
  }
}

const MAX_BATCH_SIZE = 50
/**
 * Look up fullname for multiple contacts at once
 * @param {string[]} contactIds - Array of contact GUIDs
 * @returns {Promise<Object<string, string>>} Map of contactId to fullname (or '-' if unavailable)
 * @example
 * const names = await batchGetContactNames(['guid-1', 'guid-2'])
 * // { 'guid-1': 'John Smith', 'guid-2': 'Jane Doe' }
 */
export const batchGetContactNames = async (contactIds) => {
  const {
    contactDetails: { baseUrl },
    isDynamicsEnabled
  } = config.get('dynamics')

  if (!isDynamicsEnabled || !contactIds.length) {
    return {}
  }

  const validIds = filterValidContactIds(contactIds)
  if (validIds.length === 0) {
    logger.warn('No valid contact IDs provided for batch lookup')
    return {}
  }

  logger.info(
    `Dynamics batch contact details requested for ${validIds.length} contacts`
  )

  const results = {}

  try {
    for (let i = 0; i < validIds.length; i += MAX_BATCH_SIZE) {
      const batchIds = validIds.slice(i, i + MAX_BATCH_SIZE)
      const batchResult = await retryAsyncOperation({
        operation: () => fetchContactBatch(batchIds, baseUrl),
        retries: 3,
        intervalMs: 1000
      })
      Object.assign(results, batchResult)
    }
    return results
  } catch (err) {
    logger.error(
      structureErrorForECS(err),
      'Error fetching batch contact names after retries'
    )
    // Return what we have so far, with fallbacks for any missing IDs
    validIds.forEach((id) => {
      if (!results[id]) {
        results[id] = '-'
      }
    })
    return results
  }
}
