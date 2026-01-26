import { getExemptionController } from './get-exemption'
import { vi } from 'vitest'
import {
  requestFromApplicantUser,
  requestFromInternalUser,
  requestFromPublicUser
} from '../../../../.vite/mocks.js'
vi.mock('../../../common/helpers/dynamics/get-contact-details.js', () => ({
  getContactNameById: vi.fn().mockResolvedValue('Dave Barnett')
}))

describe('GET /exemption', () => {
  const paramsValidator = getExemptionController({ requiresAuth: true }).options
    .validate.params

  const mockId = '123456789123456789123456'

  describe('Validation', () => {
    it('should fail if fields are missing', () => {
      const result = paramsValidator.validate({})

      expect(result.error.message).toContain('EXEMPTION_ID_REQUIRED')
    })

    it('should fail if fields are incorrect length', () => {
      const result = paramsValidator.validate({ id: '123' })

      expect(result.error.message).toContain('EXEMPTION_ID_REQUIRED')
    })

    it('should fail if id has incorrect characters', () => {
      const result = paramsValidator.validate({ id: mockId.replace('1', '+') })

      expect(result.error.message).toContain('EXEMPTION_ID_INVALID')
    })

    it('should get exemption by id for an internal user', async () => {
      const { mockMongo, mockHandler } = global

      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return {
          findOne: vi
            .fn()
            .mockResolvedValue({ _id: mockId, projectName: 'Test project' })
        }
      })
      await getExemptionController({ requiresAuth: true }).handler(
        requestFromInternalUser({
          params: { id: mockId }
        }),
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'success',
          value: {
            id: mockId,
            projectName: 'Test project',
            taskList: {
              publicRegister: 'INCOMPLETE',
              projectName: 'COMPLETED',
              siteDetails: 'INCOMPLETE'
            },
            whoExemptionIsFor: 'Dave Barnett'
          }
        })
      )
    })
  })

  describe('Authenticated endpoint', () => {
    it('should return 404 if ID does not exist', async () => {
      const { mockMongo, mockHandler } = global

      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return {
          findOne: vi.fn().mockResolvedValue(null)
        }
      })

      await expect(
        getExemptionController({ requiresAuth: true }).handler(
          requestFromApplicantUser({
            params: { id: mockId }
          }),
          mockHandler
        )
      ).rejects.toThrow(
        '#findExemptionById not found for id 123456789123456789123456'
      )
    })

    it('should return an error message if the database operation fails', async () => {
      const { mockMongo, mockHandler } = global

      const mockError = 'Database failed'

      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return {
          findOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
        }
      })

      await expect(() =>
        getExemptionController({ requiresAuth: true }).handler(
          requestFromApplicantUser({
            params: { id: mockId }
          }),
          mockHandler
        )
      ).rejects.toThrow(`Error retrieving exemption: ${mockError}`)
    })

    it('should get exemption by id if user is an applicant and created the exemption', async () => {
      const { mockMongo, mockHandler } = global

      const userContactId = 'abc'
      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return {
          findOne: vi.fn().mockResolvedValue({
            _id: mockId,
            projectName: 'Test project',
            contactId: userContactId
          })
        }
      })

      await getExemptionController({ requiresAuth: true }).handler(
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
            projectName: 'Test project',
            taskList: {
              publicRegister: 'INCOMPLETE',
              projectName: 'COMPLETED',
              siteDetails: 'INCOMPLETE'
            }
          }
        })
      )
    })

    it("should error user is an applicant and they didn't create the exemption", async () => {
      const { mockMongo, mockHandler } = global
      const userContactId = 'abc'

      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return {
          findOne: vi.fn().mockResolvedValue({
            _id: mockId,
            projectName: 'Test project',
            contactId: 'different-user-id'
          })
        }
      })

      await expect(
        getExemptionController({ requiresAuth: true }).handler(
          requestFromApplicantUser({
            userContactId,
            params: { id: mockId }
          }),
          mockHandler
        )
      ).rejects.toThrow('Not authorized to request this resource')
    })

    it('should get exemption by id if user is an internal user', async () => {
      const { mockMongo, mockHandler } = global

      vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
        return {
          findOne: vi.fn().mockResolvedValue({
            _id: mockId,
            projectName: 'Test project',
            contactId: 'different-user-id'
          })
        }
      })
      await getExemptionController({ requiresAuth: true }).handler(
        requestFromInternalUser({
          params: { id: mockId }
        }),
        mockHandler
      )
      expect(mockHandler.response).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'success',
          value: {
            contactId: 'different-user-id',
            id: '123456789123456789123456',
            projectName: 'Test project',
            taskList: {
              publicRegister: 'INCOMPLETE',
              projectName: 'COMPLETED',
              siteDetails: 'INCOMPLETE'
            },
            whoExemptionIsFor: 'Dave Barnett'
          }
        })
      )
    })
  })

  describe('Unauthenticated endpoint', () => {
    it('should set auth: false in options', () => {
      const controller = getExemptionController({ requiresAuth: false })

      expect(controller.options.auth).toBe(false)
    })

    it('should return exemption when exemption is active and publicRegister consent is yes', async () => {
      const { mockMongo, mockHandler } = global

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => {
        return {
          findOne: vi.fn().mockResolvedValue({
            _id: mockId,
            projectName: 'Test project',
            status: 'ACTIVE',
            publicRegister: { consent: 'yes' }
          })
        }
      })

      await getExemptionController({ requiresAuth: false }).handler(
        requestFromPublicUser({
          params: { id: mockId }
        }),
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'success',
          value: expect.objectContaining({
            id: mockId,
            projectName: 'Test project'
          })
        })
      )
    })

    it('should throw 403 when publicRegister consent is no', async () => {
      const { mockMongo, mockHandler } = global

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => {
        return {
          findOne: vi.fn().mockResolvedValue({
            _id: mockId,
            projectName: 'Test project',
            status: 'ACTIVE',
            publicRegister: { consent: 'no' }
          })
        }
      })

      await expect(
        getExemptionController({ requiresAuth: false }).handler(
          requestFromPublicUser({
            params: { id: mockId }
          }),
          mockHandler
        )
      ).rejects.toThrow('Not authorized to request this resource')
    })

    it('should throw 403 when exemption is not complete', async () => {
      const { mockMongo, mockHandler } = global

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => {
        return {
          findOne: vi.fn().mockResolvedValue({
            _id: mockId,
            projectName: 'Test project',
            status: 'DRAFT',
            publicRegister: { consent: 'yes' }
          })
        }
      })

      await expect(
        getExemptionController({ requiresAuth: false }).handler(
          requestFromPublicUser({
            params: { id: mockId }
          }),
          mockHandler
        )
      ).rejects.toThrow('Not authorized to request this resource')
    })
  })
})
