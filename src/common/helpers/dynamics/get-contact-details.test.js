import { getContactNameById } from './get-contact-details.js'
import Wreck from '@hapi/wreck'
import { createLogger } from '../logging/logger.js'
import Boom from '@hapi/boom'
import { getDynamicsAccessToken } from './get-access-token.js'
import { config } from '../../../config.js'

vi.mock('./get-access-token.js')
vi.mock('../../../config.js')

describe('Get contact name from Dynamics 365', () => {
  const contactId = '9f969b49-3278-f011-b4cc-7ced8d5a7314'
  const accessToken = '123abc'
  const logger = createLogger()

  beforeEach(() => {
    vi.spyOn(logger, 'info')
    vi.spyOn(logger, 'error')
    config.get.mockReturnValue({
      isDynamicsEnabled: true,
      contactDetails: {
        apiUrl:
          'https://marinelicensingdev.crm11.dynamics.com/api/data/v9.2/contacts({{contactId}})?$select=fullname'
      }
    })
  })

  it('should call the Dynamics API and return name for the requested contact ID', async () => {
    const wreckGetSpy = vi.spyOn(Wreck, 'get').mockResolvedValue({
      res: {
        statusCode: 200
      },
      payload: Buffer.from(
        JSON.stringify({
          fullname: 'Dave Bassett'
        })
      )
    })
    vi.mocked(getDynamicsAccessToken).mockResolvedValue(accessToken)
    const contactName = await getContactNameById({
      contactId
    })
    expect(contactName).toEqual('Dave Bassett')

    expect(wreckGetSpy).toHaveBeenCalledWith(
      `https://marinelicensingdev.crm11.dynamics.com/api/data/v9.2/contacts(${contactId})?$select=fullname`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'OData-Version': '4.0',
          'OData-MaxVersion': '4.0'
        }
      }
    )
    expect(logger.info).toHaveBeenCalledWith(
      `Dynamics contact details requested for ID ${contactId}`
    )
  })

  it('should return null if the contact details request returns an error', async () => {
    vi.spyOn(Wreck, 'get').mockRejectedValue(Boom.internal('Server error'))
    vi.mocked(getDynamicsAccessToken).mockResolvedValue(accessToken)

    const contactName = await getContactNameById({
      contactId,
      accessToken
    })
    expect(contactName).toBeNull()
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Server error'
        })
      }),
      `Error - Dynamics contact details request for ID ${contactId}`
    )
  })

  it('should return null if Dynamics is not enabled', async () => {
    config.get.mockReturnValue({
      isDynamicsEnabled: false
    })
    const contactName = await getContactNameById({
      contactId
    })
    expect(contactName).toBeNull()
  })
})
