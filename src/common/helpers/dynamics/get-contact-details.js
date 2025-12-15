import Wreck from '@hapi/wreck'
import Boom from '@hapi/boom'
import { createLogger, structureErrorForECS } from '../logging/logger.js'
import { getDynamicsAccessToken } from './get-access-token.js'
import { config } from '../../../config.js'

const logger = createLogger()

export const getContactNameById = async ({ contactId }) => {
  logger.info(`Dynamics contact details requested for ID ${contactId}`)
  try {
    const { apiUrl, isDynamicsEnabled } = config.get('dynamics')
    if (!isDynamicsEnabled) {
      return null
    }
    const endpoint = apiUrl.contactDetails.replace('{{contactId}}', contactId)
    const accessToken = await getDynamicsAccessToken({
      scopeType: 'contactDetails'
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
    throw Boom.badImplementation(`Dynamics contact details API error`)
  }
}
