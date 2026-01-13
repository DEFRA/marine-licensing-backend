import Wreck from '@hapi/wreck'
import { createLogger, structureErrorForECS } from '../logging/logger.js'
import { getDynamicsAccessToken } from './get-access-token.js'
import { retryAsyncOperation } from '../retry-async-operation.js'
import { config } from '../../../config.js'

const logger = createLogger()

// Helper function to validate GUID format
const isValidGuid = (guid) => {
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return guidRegex.test(guid)
}

// Helper function to escape OData string values
const escapeODataString = (str) => {
  return String(str).replaceAll("'", "''")
}

export const getContactNameById = async ({ contactId }) => {
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
    const accessToken = await getDynamicsAccessToken({
      type: 'contactDetails'
    })
    const response = await Wreck.get(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'OData-Version': '4.0',
        'OData-MaxVersion': '4.0'
      }
    })
    const jsonString = Buffer.from(response.payload).toString('utf8')
    const parsedData = JSON.parse(jsonString)
    const { fullname } = parsedData
    return fullname
  } catch (err) {
    logger.error(
      structureErrorForECS(err),
      `Error - Dynamics contact details request for ID ${contactId}`
    )
    return null
  }
}

export const batchGetContactNames = async (contactIds) => {
  const {
    contactDetails: { baseUrl },
    isDynamicsEnabled
  } = config.get('dynamics')

  if (!isDynamicsEnabled || !contactIds.length) {
    return {}
  }

  const uniqueIds = [...new Set(contactIds)]

  // Validate and sanitize IDs
  const processedIds = uniqueIds.reduce((acc, id) => {
    if (!id) {
      logger.warn('Empty contact ID provided')
      return acc
    }

    if (!isValidGuid(id)) {
      logger.warn(`Invalid contact ID format: ${id}`)
      return acc
    }

    acc.push(id)
    return acc
  }, [])

  if (processedIds.length === 0) {
    logger.warn('No valid contact IDs provided for batch lookup')
    return {}
  }

  logger.info(
    `Dynamics batch contact details requested for ${processedIds.length} contacts`
  )

  // We will need to address max batch sizes and pagination in a future ticket.
  const MAX_BATCH_SIZE = 50 // Dynamics typically has limits

  if (processedIds.length > MAX_BATCH_SIZE) {
    logger.warn(
      `Batch size (${processedIds.length}) exceeds recommended limit (${MAX_BATCH_SIZE})`
    )
  }

  try {
    return await retryAsyncOperation({
      operation: async () => {
        const accessToken = await getDynamicsAccessToken({
          type: 'contactDetails'
        })

        // Even though we validated GUIDs, still escape as defense in depth
        const filterClauses = processedIds
          .map((id) => `contactid eq '${escapeODataString(id)}'`)
          .join(' or ')
        const endpoint = `${baseUrl}/contacts?$select=fullname,contactid&$filter=${filterClauses}`

        const response = await Wreck.get(endpoint, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'OData-Version': '4.0',
            'OData-MaxVersion': '4.0'
          }
        })

        const jsonString = Buffer.from(response.payload).toString('utf8')
        const parsedData = JSON.parse(jsonString)
        const contacts = parsedData.value || []

        return contacts.reduce((map, contact) => {
          map[contact.contactid] = contact.fullname || '-'
          return map
        }, {})
      },
      retries: 3,
      intervalMs: 1000
    })
  } catch (err) {
    logger.error(
      structureErrorForECS(err),
      'Error fetching batch contact names after retries'
    )
    return {}
  }
}
