import { getMarineLicenceByApplicationReferenceController } from './get-marine-licence-by-application-reference.js'
import { vi } from 'vitest'
import {
  requestFromApplicantUser,
  requestFromInternalUser
} from '../../../../.vite/mocks.js'

describe('GET /marine-licence/reference/{applicationReference}', () => {
  const paramsValidator =
    getMarineLicenceByApplicationReferenceController.options.validate.params

  const applicationReference = 'MLA-2026-10001'

  let mockedFindOne

  beforeEach(() => {
    vi.clearAllMocks()
    mockedFindOne = vi.fn().mockResolvedValue(null)
    vi.spyOn(global.mockMongo, 'collection').mockImplementation(function () {
      return { findOne: mockedFindOne }
    })
  })

  describe('Validation', () => {
    it('should fail if applicationReference is missing', () => {
      const result = paramsValidator.validate({})

      expect(result.error.message).toContain('APPLICATION_REFERENCE_REQUIRED')
    })

    it('should fail if applicationReference has the wrong format', () => {
      const result = paramsValidator.validate({
        applicationReference: 'not-a-reference'
      })

      expect(result.error.message).toContain('APPLICATION_REFERENCE_INVALID')
    })

    it('should pass for a valid applicationReference', () => {
      const result = paramsValidator.validate({ applicationReference })

      expect(result.error).toBeUndefined()
    })
  })

  it('should reject a defraId applicant', async () => {
    const { mockHandler } = global

    await expect(
      getMarineLicenceByApplicationReferenceController.handler(
        requestFromApplicantUser({ params: { applicationReference } }),
        mockHandler
      )
    ).rejects.toThrow('Not authorised to view this marine licence')

    expect(mockedFindOne).not.toHaveBeenCalled()
  })

  it('should return 404 if applicationReference does not exist', async () => {
    const { mockHandler } = global

    mockedFindOne.mockResolvedValue(null)

    await expect(
      getMarineLicenceByApplicationReferenceController.handler(
        requestFromInternalUser({ params: { applicationReference } }),
        mockHandler
      )
    ).rejects.toThrow('Marine Licence not found')
  })

  it('should query the database with slashes in place of the path-safe hyphens, and return the marine licence for an internal (Entra ID) user', async () => {
    const { mockHandler } = global

    mockedFindOne.mockResolvedValue({
      _id: '123456789123456789123456',
      projectName: 'Test project',
      contactId: 'someone-elses-id',
      applicationReference: 'MLA/2026/10001'
    })

    await getMarineLicenceByApplicationReferenceController.handler(
      requestFromInternalUser({ params: { applicationReference } }),
      mockHandler
    )

    expect(mockedFindOne).toHaveBeenCalledWith({
      applicationReference: 'MLA/2026/10001'
    })
    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'success' })
    )
  })
})
