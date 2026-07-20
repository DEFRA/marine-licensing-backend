import { getMarineLicenceController } from './get-marine-licence.js'
import { vi } from 'vitest'
import {
  requestFromApplicantUser,
  requestFromInternalUser
} from '../../../../.vite/mocks.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { preferredDates } from '../../models/test-fixtures.js'
import { mockCompleteSite } from '../../../../tests/test.fixture.js'

describe('GET /marine-licence', () => {
  const authenticatedController = getMarineLicenceController({
    requiresAuth: true
  })
  const publicController = getMarineLicenceController({ requiresAuth: false })
  const paramsValidator = authenticatedController.options.validate.params

  const mockId = '123456789123456789123456'

  let mockedFindOne

  beforeEach(() => {
    vi.clearAllMocks()
    mockedFindOne = vi.fn().mockResolvedValue(null)
    vi.spyOn(global.mockMongo, 'collection').mockImplementation(function () {
      return { findOne: mockedFindOne }
    })
  })

  describe('Validation', () => {
    it('should fail if fields are missing', () => {
      const result = paramsValidator.validate({})

      expect(result.error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
    })

    it('should fail if fields are incorrect length', () => {
      const result = paramsValidator.validate({ id: '123' })

      expect(result.error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
    })

    it('should fail if id has incorrect characters', () => {
      const result = paramsValidator.validate({ id: mockId.replace('1', '+') })

      expect(result.error.message).toContain('MARINE_LICENCE_ID_INVALID')
    })
  })

  describe('Authenticated endpoint', () => {
    it('should return 404 if ID does not exist', async () => {
      const { mockHandler } = global

      mockedFindOne.mockResolvedValue(null)

      await expect(
        authenticatedController.handler(
          requestFromApplicantUser({
            params: { id: mockId }
          }),
          mockHandler
        )
      ).rejects.toThrow('Marine Licence not found')

      expect(mockedFindOne).toHaveBeenCalled()
    })

    it('should return an error message if the database operation fails', async () => {
      const { mockHandler } = global

      const mockError = 'Database failed'
      mockedFindOne.mockRejectedValue(new Error(mockError))

      await expect(() =>
        authenticatedController.handler(
          requestFromApplicantUser({
            params: { id: mockId }
          }),
          mockHandler
        )
      ).rejects.toThrow(`Error retrieving marine licence: ${mockError}`)

      expect(mockedFindOne).toHaveBeenCalled()
    })

    it('should get marine licence by id if user created the marine licence', async () => {
      const { mockHandler } = global

      const userContactId = 'abc'
      mockedFindOne.mockResolvedValue({
        _id: mockId,
        feeEstimate: { accept: 'yes', termsAndConditions: true, feeBand: '2A' },
        harbourAuthority: {
          area: 'yes',
          details: 'Harbour authority details'
        },
        projectName: 'Test project',
        publicRegister: {
          consent: 'yes',
          reason: 'Test public register reason'
        },
        preferredDates,
        publicConsultation: {
          consulted: 'yes',
          details: 'Public consultation details'
        },
        otherAuthorities: 'Test authority',
        projectBackground: 'Test project background',
        contactId: userContactId
      })

      await authenticatedController.handler(
        requestFromApplicantUser({
          userContactId,
          params: { id: mockId }
        }),
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'success',
          value: {
            id: mockId,
            contactId: userContactId,
            feeEstimate: {
              accept: 'yes',
              termsAndConditions: true,
              feeBand: '2A'
            },
            harbourAuthority: {
              area: 'yes',
              details: 'Harbour authority details'
            },
            projectName: 'Test project',
            publicRegister: {
              consent: 'yes',
              reason: 'Test public register reason'
            },
            preferredDates,
            publicConsultation: {
              consulted: 'yes',
              details: 'Public consultation details'
            },
            otherAuthorities: 'Test authority',
            projectBackground: 'Test project background',
            marinePlanPolicyJob: null,
            marinePlanPolicies: [],
            marinePlanPolicyResponses: {},
            marinePlanPolicyResponseCount: 0,
            taskList: {
              feeEstimate: 'COMPLETED',
              harbourAuthority: 'COMPLETED',
              preferredDates: 'COMPLETED',
              projectName: 'COMPLETED',
              otherAuthorities: 'COMPLETED',
              projectBackground: 'COMPLETED',
              publicRegister: 'COMPLETED',
              publicConsultation: 'COMPLETED',
              siteDetails: 'INCOMPLETE',
              waterFrameworkDirective: 'INCOMPLETE',
              marinePlanPolicies: 'INCOMPLETE'
            },
            siteDetailsDataComplete: false
          }
        })
      )
    })

    it('should filter marinePlanPolicyResponses down to the current policy set and count only those', async () => {
      const { mockHandler } = global

      const userContactId = 'abc'
      mockedFindOne.mockResolvedValue({
        _id: mockId,
        projectName: 'Test project',
        contactId: userContactId,
        marinePlanPolicyJob: 'ready',
        marinePlanPolicies: [
          { policyCode: 'NEW-1', sector: 'sector-a' },
          { policyCode: 'NEW-2', sector: 'sector-a' }
        ],
        marinePlanPoliciesCount: 2,
        marinePlanPolicyResponses: {
          'OLD-1': 'a stale answer from a previous site',
          'NEW-1': 'answer for the current set'
        },
        marinePlanPolicyResponseCount: 2
      })

      await authenticatedController.handler(
        requestFromApplicantUser({
          userContactId,
          params: { id: mockId }
        }),
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'success',
          value: expect.objectContaining({
            marinePlanPolicyResponses: {
              'NEW-1': 'answer for the current set'
            },
            marinePlanPolicyResponseCount: 1,
            taskList: expect.objectContaining({
              marinePlanPolicies: 'IN_PROGRESS'
            })
          })
        })
      )
    })

    it('should report siteDetailsDataComplete as true when site data is valid regardless of siteDetailsConfirmed', async () => {
      const { mockHandler } = global

      mockedFindOne.mockResolvedValue({
        _id: mockId,
        projectName: 'Test project',
        contactId: 'abc',
        siteDetails: [mockCompleteSite],
        siteDetailsConfirmed: false
      })

      await authenticatedController.handler(
        requestFromApplicantUser({
          userContactId: 'abc',
          params: { id: mockId }
        }),
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith(
        expect.objectContaining({
          value: expect.objectContaining({ siteDetailsDataComplete: true })
        })
      )
    })

    it('should report siteDetailsDataComplete as false when site data is invalid even if siteDetailsConfirmed is true', async () => {
      const { mockHandler } = global

      mockedFindOne.mockResolvedValue({
        _id: mockId,
        projectName: 'Test project',
        contactId: 'abc',
        siteDetails: [],
        siteDetailsConfirmed: true
      })

      await authenticatedController.handler(
        requestFromApplicantUser({
          userContactId: 'abc',
          params: { id: mockId }
        }),
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith(
        expect.objectContaining({
          value: expect.objectContaining({ siteDetailsDataComplete: false })
        })
      )
    })

    it('should allow an internal (Entra ID) user to access any marine licence', async () => {
      const { mockHandler } = global

      mockedFindOne.mockResolvedValue({
        _id: mockId,
        projectName: 'Test project',
        contactId: 'someone-elses-id'
      })

      await authenticatedController.handler(
        requestFromInternalUser({ params: { id: mockId } }),
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'success' })
      )
    })

    it("should error if user didn't create the marine licence", async () => {
      const { mockHandler } = global
      const userContactId = 'abc'

      mockedFindOne.mockResolvedValue({
        _id: mockId,
        projectName: 'Test project',
        contactId: 'different-user-id'
      })

      await expect(
        authenticatedController.handler(
          requestFromApplicantUser({
            userContactId,
            params: { id: mockId }
          }),
          mockHandler
        )
      ).rejects.toThrow('Not authorised to request this resource')

      expect(mockedFindOne).toHaveBeenCalled()
    })
  })

  describe('Public endpoint', () => {
    const mockPublicRequest = (overrides = {}) => ({
      params: { id: mockId },
      db: global.mockMongo,
      logger: { info: vi.fn(), error: vi.fn() },
      ...overrides
    })

    it('should return 404 if ID does not exist', async () => {
      const { mockHandler } = global

      mockedFindOne.mockResolvedValue(null)

      await expect(
        publicController.handler(mockPublicRequest(), mockHandler)
      ).rejects.toThrow('Marine Licence not found')
    })

    it('should return an error message if the database operation fails', async () => {
      const { mockHandler } = global

      const mockError = 'Database failed'
      mockedFindOne.mockRejectedValue(new Error(mockError))

      await expect(() =>
        publicController.handler(mockPublicRequest(), mockHandler)
      ).rejects.toThrow(`Error retrieving marine licence: ${mockError}`)
    })

    it('should return marine licence for a SUBMITTED record', async () => {
      const { mockHandler } = global

      mockedFindOne.mockResolvedValue({
        _id: mockId,
        projectName: 'Test project',
        contactId: 'abc',
        status: MARINE_LICENCE_STATUS.SUBMITTED,
        organisation: { name: 'Dredging Co' }
      })

      await publicController.handler(mockPublicRequest(), mockHandler)

      expect(mockHandler.response).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'success',
          value: expect.objectContaining({
            id: mockId,
            projectName: 'Test project',
            whoMarineLicenceIsFor: 'Dredging Co'
          })
        })
      )
    })

    it('should throw forbidden if status is not SUBMITTED', async () => {
      const { mockHandler } = global

      mockedFindOne.mockResolvedValue({
        _id: mockId,
        projectName: 'Test project',
        contactId: 'abc',
        status: MARINE_LICENCE_STATUS.DRAFT
      })

      await expect(
        publicController.handler(mockPublicRequest(), mockHandler)
      ).rejects.toThrow('Not authorised to request this resource')
    })
  })
})