import { getMarineLicenceController } from './get-marine-licence.js'
import { vi } from 'vitest'
import { requestFromApplicantUser } from '../../../../.vite/mocks.js'

describe('GET /marine-licence', () => {
  const paramsValidator = getMarineLicenceController.options.validate.params

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
        getMarineLicenceController.handler(
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
        getMarineLicenceController.handler(
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
        projectName: 'Test project',
        contactId: userContactId
      })

      await getMarineLicenceController.handler(
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

    it("should error if user didn't create the marine licence", async () => {
      const { mockHandler } = global
      const userContactId = 'abc'

      mockedFindOne.mockResolvedValue({
        _id: mockId,
        projectName: 'Test project',
        contactId: 'different-user-id'
      })

      await expect(
        getMarineLicenceController.handler(
          requestFromApplicantUser({
            userContactId,
            params: { id: mockId }
          }),
          mockHandler
        )
      ).rejects.toThrow('Not authorized to request this resource')

      expect(mockedFindOne).toHaveBeenCalled()
    })
  })
})
