import { getMarineLicenseController } from './get-marine-license.js'
import { vi } from 'vitest'
import { requestFromApplicantUser } from '../../../../.vite/mocks.js'

describe('GET /marine-license', () => {
  const paramsValidator = getMarineLicenseController.options.validate.params

  const mockId = '123456789123456789123456'

  describe('Validation', () => {
    it('should fail if fields are missing', () => {
      const result = paramsValidator.validate({})

      expect(result.error.message).toContain('MARINE_LICENSE_ID_REQUIRED')
    })

    it('should fail if fields are incorrect length', () => {
      const result = paramsValidator.validate({ id: '123' })

      expect(result.error.message).toContain('MARINE_LICENSE_ID_REQUIRED')
    })

    it('should fail if id has incorrect characters', () => {
      const result = paramsValidator.validate({ id: mockId.replace('1', '+') })

      expect(result.error.message).toContain('MARINE_LICENSE_ID_INVALID')
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
        getMarineLicenseController.handler(
          requestFromApplicantUser({
            params: { id: mockId }
          }),
          mockHandler
        )
      ).rejects.toThrow('Marine License not found')
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
        getMarineLicenseController.handler(
          requestFromApplicantUser({
            params: { id: mockId }
          }),
          mockHandler
        )
      ).rejects.toThrow(`Error retrieving marine license: ${mockError}`)
    })

    it('should get marine license by id if user created the marine license', async () => {
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

      await getMarineLicenseController.handler(
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
              projectName: 'COMPLETED'
            }
          }
        })
      )
    })

    it("should error if user didn't create the marine license", async () => {
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
        getMarineLicenseController.handler(
          requestFromApplicantUser({
            userContactId,
            params: { id: mockId }
          }),
          mockHandler
        )
      ).rejects.toThrow('Not authorized to request this resource')
    })
  })
})
