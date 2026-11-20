import Wreck from '@hapi/wreck'
import Boom from '@hapi/boom'
import { warmUpDynamics } from './warm-up-dynamics.js'
import { getDynamicsAccessToken } from './get-access-token.js'
import { config } from '../../../../config.js'

vi.mock('./get-access-token.js')
vi.mock('../../../../config.js')

describe('warmUpDynamics', () => {
  const path = '/contacts?$select=fullname&$top=1'
  const baseUrl = 'https://dynamics.example.com/api/data/v9.2'
  const okResponse = {
    res: { statusCode: 200 },
    payload: Buffer.from('{"value":[]}')
  }

  beforeEach(() => {
    config.get.mockReturnValue({
      isDynamicsEnabled: true,
      contactDetails: { baseUrl }
    })
    vi.mocked(getDynamicsAccessToken).mockResolvedValue('test-token')
  })

  it('requests a contact-details token and GETs the configured path on the contact-details base URL', async () => {
    const wreckGetSpy = vi.spyOn(Wreck, 'get').mockResolvedValue(okResponse)

    await warmUpDynamics({ path })

    expect(getDynamicsAccessToken).toHaveBeenCalledWith({
      type: 'contactDetails',
      timeoutMs: 30000
    })
    expect(wreckGetSpy).toHaveBeenCalledWith(
      'https://dynamics.example.com/api/data/v9.2/contacts?$select=fullname&$top=1',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer test-token',
          Accept: 'application/json',
          'OData-Version': '4.0',
          'OData-MaxVersion': '4.0'
        }
      })
    )
  })

  it('reports the status and the token and request timings', async () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1412)
      .mockReturnValueOnce(3730)
    vi.spyOn(Wreck, 'get').mockResolvedValue(okResponse)

    const result = await warmUpDynamics({ path })

    expect(result).toEqual({
      summary: '200 from Dataverse; token 412ms, request 2,318ms'
    })
  })

  it('passes a timeout to the token fetch and the request', async () => {
    const wreckGetSpy = vi.spyOn(Wreck, 'get').mockResolvedValue(okResponse)

    await warmUpDynamics({ path })

    expect(wreckGetSpy.mock.calls[0][1]).toMatchObject({ timeout: 30000 })
  })

  it('skips without any outbound call when Dynamics is disabled', async () => {
    config.get.mockReturnValue({
      isDynamicsEnabled: false,
      contactDetails: { baseUrl }
    })
    const wreckGetSpy = vi.spyOn(Wreck, 'get')

    const result = await warmUpDynamics({ path })

    expect(result).toEqual({ summary: 'skipped: Dynamics disabled' })
    expect(getDynamicsAccessToken).not.toHaveBeenCalled()
    expect(wreckGetSpy).not.toHaveBeenCalled()
  })

  it('rejects when the request fails', async () => {
    vi.spyOn(Wreck, 'get').mockRejectedValue(
      Boom.badGateway('Response Error: 503')
    )

    await expect(warmUpDynamics({ path })).rejects.toThrow(
      'Response Error: 503'
    )
  })

  it('rejects without requesting Dataverse when the token fetch fails', async () => {
    vi.mocked(getDynamicsAccessToken).mockRejectedValue(
      new Error('Dynamics token request failed')
    )
    const wreckGetSpy = vi.spyOn(Wreck, 'get')

    await expect(warmUpDynamics({ path })).rejects.toThrow(
      'Dynamics token request failed'
    )
    expect(wreckGetSpy).not.toHaveBeenCalled()
  })
})
