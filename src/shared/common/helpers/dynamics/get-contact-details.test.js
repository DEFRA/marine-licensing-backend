import {
  getContactNameById,
  batchGetContactNames
} from './get-contact-details.js'
import Wreck from '@hapi/wreck'
import { createLogger } from '../logging/logger.js'
import Boom from '@hapi/boom'
import { getDynamicsAccessToken } from './get-access-token.js'
import { config } from '../../../../config.js'
import { retryAsyncOperation } from '../retry-async-operation.js'

vi.mock('./get-access-token.js')
vi.mock('../../../../config.js')
vi.mock('../retry-async-operation.js')

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
      isDynamicsEnabled: false,
      contactDetails: {
        apiUrl:
          'https://marinelicensingdev.crm11.dynamics.com/api/data/v9.2/contacts({{contactId}})?$select=fullname'
      }
    })
    const contactName = await getContactNameById({
      contactId
    })
    expect(contactName).toBeNull()
  })

  it('should return null if contactId is not a valid GUID', async () => {
    const contactName = await getContactNameById({
      contactId: 'invalid-id'
    })
    expect(contactName).toBeNull()
  })
})

describe('batchGetContactNames', () => {
  const accessToken = '123abc'
  const baseUrl = 'https://marinelicensingdev.crm11.dynamics.com/api/data/v9.2'
  const logger = createLogger()
  const validGuid1 = '9f969b49-3278-f011-b4cc-7ced8d5a7314'
  const validGuid2 = '8e858b38-2167-e000-a3bb-6bdc7c4a6203'

  beforeEach(() => {
    vi.spyOn(logger, 'info')
    vi.spyOn(logger, 'warn')
    vi.spyOn(logger, 'error')
    config.get.mockReturnValue({
      isDynamicsEnabled: true,
      contactDetails: {
        baseUrl
      }
    })
    vi.mocked(getDynamicsAccessToken).mockResolvedValue(accessToken)
  })

  describe('Early returns', () => {
    it('should return empty object when Dynamics is disabled', async () => {
      config.get.mockReturnValue({
        isDynamicsEnabled: false,
        contactDetails: { baseUrl }
      })

      const result = await batchGetContactNames([validGuid1])
      expect(result).toEqual({})
    })

    it('should return empty object when contactIds array is empty', async () => {
      const result = await batchGetContactNames([])
      expect(result).toEqual({})
    })

    it('should return empty object when all contact IDs are invalid', async () => {
      const result = await batchGetContactNames([
        'invalid-id',
        'another-invalid',
        ''
      ])
      expect(result).toEqual({})
      expect(logger.warn).toHaveBeenCalledWith(
        'No valid contact IDs provided for batch lookup'
      )
    })

    it('should filter out empty contact IDs', async () => {
      vi.mocked(retryAsyncOperation).mockResolvedValue({
        [validGuid1]: 'John Smith'
      })

      const result = await batchGetContactNames([validGuid1, '', null])
      expect(result).toEqual({ [validGuid1]: 'John Smith' })
      expect(logger.warn).toHaveBeenCalledWith('Empty contact ID provided')
    })

    it('should filter out invalid GUID formats', async () => {
      vi.mocked(retryAsyncOperation).mockResolvedValue({
        [validGuid1]: 'John Smith'
      })

      const result = await batchGetContactNames([validGuid1, 'not-a-guid'])
      expect(result).toEqual({ [validGuid1]: 'John Smith' })
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid contact ID format: not-a-guid'
      )
    })

    it('should deduplicate contact IDs', async () => {
      vi.mocked(retryAsyncOperation).mockResolvedValue({
        [validGuid1]: 'John Smith'
      })

      const result = await batchGetContactNames([
        validGuid1,
        validGuid1,
        validGuid1
      ])
      expect(result).toEqual({ [validGuid1]: 'John Smith' })
      expect(retryAsyncOperation).toHaveBeenCalledTimes(1)
    })
  })

  describe('Successful batch requests', () => {
    it('should return contact names for valid contact IDs', async () => {
      vi.mocked(retryAsyncOperation).mockResolvedValue({
        [validGuid1]: 'John Smith',
        [validGuid2]: 'Jane Doe'
      })

      const result = await batchGetContactNames([validGuid1, validGuid2])

      expect(result).toEqual({
        [validGuid1]: 'John Smith',
        [validGuid2]: 'Jane Doe'
      })
      expect(logger.info).toHaveBeenCalledWith(
        'Dynamics batch contact details requested for 2 contacts'
      )
    })

    it('should call retryAsyncOperation with correct parameters', async () => {
      vi.mocked(retryAsyncOperation).mockResolvedValue({
        [validGuid1]: 'John Smith'
      })

      await batchGetContactNames([validGuid1])

      expect(retryAsyncOperation).toHaveBeenCalledWith({
        operation: expect.any(Function),
        retries: 3,
        intervalMs: 1000
      })
    })

    it('should handle contacts with missing fullname by returning dash', async () => {
      vi.mocked(retryAsyncOperation).mockResolvedValue({
        [validGuid1]: '-'
      })

      const result = await batchGetContactNames([validGuid1])
      expect(result).toEqual({ [validGuid1]: '-' })
    })
  })

  describe('Error handling', () => {
    it('should return fallback values when batch request fails', async () => {
      vi.mocked(retryAsyncOperation).mockRejectedValue(
        new Error('Network error')
      )

      const result = await batchGetContactNames([validGuid1, validGuid2])

      expect(result).toEqual({
        [validGuid1]: '-',
        [validGuid2]: '-'
      })
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Network error'
          })
        }),
        'Error fetching batch contact names after retries'
      )
    })
  })

  describe('Batch size handling', () => {
    it('should process contacts in batches of 50', async () => {
      const manyGuids = Array.from({ length: 75 }, (_, i) => {
        const hex = i.toString(16).padStart(8, '0')
        return `${hex}-0000-0000-0000-000000000000`
      })

      vi.mocked(retryAsyncOperation)
        .mockResolvedValueOnce(
          Object.fromEntries(manyGuids.slice(0, 50).map((g) => [g, 'Name']))
        )
        .mockResolvedValueOnce(
          Object.fromEntries(manyGuids.slice(50).map((g) => [g, 'Name']))
        )

      const result = await batchGetContactNames(manyGuids)

      expect(retryAsyncOperation).toHaveBeenCalledTimes(2)
      expect(Object.keys(result)).toHaveLength(75)
    })
  })
})

describe('batchGetContactNames - fetchContactBatch integration', () => {
  const accessToken = '123abc'
  const baseUrl = 'https://marinelicensingdev.crm11.dynamics.com/api/data/v9.2'
  const logger = createLogger()
  const validGuid1 = '9f969b49-3278-f011-b4cc-7ced8d5a7314'
  const validGuid2 = '8e858b38-2167-e000-a3bb-6bdc7c4a6203'

  beforeEach(() => {
    vi.spyOn(logger, 'info')
    vi.spyOn(logger, 'warn')
    vi.spyOn(logger, 'error')
    config.get.mockReturnValue({
      isDynamicsEnabled: true,
      contactDetails: {
        baseUrl
      }
    })
    vi.mocked(getDynamicsAccessToken).mockResolvedValue(accessToken)
    vi.mocked(retryAsyncOperation).mockImplementation(({ operation }) =>
      operation()
    )
  })

  it('should call Dynamics API with correct OData filter', async () => {
    const wreckGetSpy = vi.spyOn(Wreck, 'get').mockResolvedValue({
      payload: Buffer.from(
        JSON.stringify({
          value: [
            { contactid: validGuid1, fullname: 'John Smith' },
            { contactid: validGuid2, fullname: 'Jane Doe' }
          ]
        })
      )
    })

    const result = await batchGetContactNames([validGuid1, validGuid2])

    expect(wreckGetSpy).toHaveBeenCalledWith(
      `${baseUrl}/contacts?$select=fullname,contactid&$filter=contactid eq '${validGuid1}' or contactid eq '${validGuid2}'`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'OData-Version': '4.0',
          'OData-MaxVersion': '4.0'
        }
      }
    )
    expect(result).toEqual({
      [validGuid1]: 'John Smith',
      [validGuid2]: 'Jane Doe'
    })
  })

  it('should handle contacts with missing fullname', async () => {
    vi.spyOn(Wreck, 'get').mockResolvedValue({
      payload: Buffer.from(
        JSON.stringify({
          value: [{ contactid: validGuid1, fullname: null }]
        })
      )
    })

    const result = await batchGetContactNames([validGuid1])

    expect(result).toEqual({ [validGuid1]: '-' })
  })

  it('should handle empty value array from Dynamics', async () => {
    vi.spyOn(Wreck, 'get').mockResolvedValue({
      payload: Buffer.from(JSON.stringify({ value: [] }))
    })

    const result = await batchGetContactNames([validGuid1])

    expect(result).toEqual({})
  })

  it('should handle missing value property from Dynamics', async () => {
    vi.spyOn(Wreck, 'get').mockResolvedValue({
      payload: Buffer.from(JSON.stringify({}))
    })

    const result = await batchGetContactNames([validGuid1])

    expect(result).toEqual({})
  })

  it('should escape single quotes in contact IDs for OData query', async () => {
    const guidWithQuote = '9f969b49-3278-f011-b4cc-7ced8d5a7314'
    const wreckGetSpy = vi.spyOn(Wreck, 'get').mockResolvedValue({
      payload: Buffer.from(JSON.stringify({ value: [] }))
    })

    await batchGetContactNames([guidWithQuote])

    expect(wreckGetSpy).toHaveBeenCalledWith(
      expect.stringContaining(`contactid eq '${guidWithQuote}'`),
      expect.any(Object)
    )
  })

  it('should reject contact IDs with whitespace (invalid GUID format)', async () => {
    const guidWithSpaces = '  9f969b49-3278-f011-b4cc-7ced8d5a7314  '

    const result = await batchGetContactNames([guidWithSpaces])

    expect(result).toEqual({})
    expect(logger.warn).toHaveBeenCalledWith(
      `Invalid contact ID format: ${guidWithSpaces}`
    )
  })
})
