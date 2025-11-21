import { getExemptionController } from './get-exemption'
import { vi } from 'vitest'

describe('GET /exemption', () => {
  const paramsValidator = getExemptionController({ requiresAuth: true }).options
    .validate.params

  const mockId = '123456789123456789123456'

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

  it('should get exemption by id', async () => {
    const { mockMongo, mockHandler } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        findOne: vi
          .fn()
          .mockResolvedValue({ _id: mockId, projectName: 'Test project' })
      }
    })

    await getExemptionController({ requiresAuth: true }).handler(
      {
        db: mockMongo,
        params: { id: mockId },
        auth: { artifacts: { decoded: { tid: 'abc' } } }
      },
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
          }
        }
      })
    )
  })

  it('should return 404 if ID does not exist', async () => {
    const { mockMongo, mockHandler } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        findOne: vi.fn().mockResolvedValue(null)
      }
    })

    await expect(
      getExemptionController({ requiresAuth: true }).handler(
        {
          db: mockMongo,
          params: { id: mockId },
          auth: { artifacts: { decoded: { tid: 'abc' } } }
        },
        mockHandler
      )
    ).rejects.toThrow('Exemption not found')
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        findOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(() =>
      getExemptionController({ requiresAuth: true }).handler(
        {
          db: mockMongo,
          params: { id: mockId },
          auth: {
            credentials: { contactId: 'abc' },
            artifacts: { decoded: {} }
          }
        },
        mockHandler
      )
    ).rejects.toThrow(`Error retrieving exemption: ${mockError}`)
  })

  it('if the request is authorized by defraID, should check exemption ID matches user contact ID', async () => {
    const { mockMongo, mockHandler } = global
    const userId = 'abc'

    vi.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        findOne: vi.fn().mockResolvedValue({
          _id: mockId,
          projectName: 'Test project',
          contactId: userId
        })
      }
    })

    await getExemptionController({ requiresAuth: true }).handler(
      {
        db: mockMongo,
        params: { id: mockId },
        auth: { credentials: { contactId: userId }, artifacts: { decoded: {} } }
      },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'success',
        value: {
          id: mockId,
          contactId: userId,
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

  it('if the request is authorized by defraID, error if exemption ID does not match user contact ID', async () => {
    const { mockMongo, mockHandler } = global
    const userId = 'abc'

    vi.spyOn(mockMongo, 'collection').mockImplementation(() => {
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
        {
          db: mockMongo,
          params: { id: mockId },
          auth: {
            credentials: { contactId: userId },
            artifacts: { decoded: {} }
          }
        },
        mockHandler
      )
    ).rejects.toThrow('Not authorized to request this resource')
  })

  it("if there is no auth token, don't check ownership authorization", async () => {
    const { mockMongo, mockHandler } = global

    vi.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        findOne: vi.fn().mockResolvedValue({
          _id: mockId,
          projectName: 'Test project',
          contactId: 'different-user-id'
        })
      }
    })
    await getExemptionController({ requiresAuth: true }).handler(
      {
        db: mockMongo,
        params: { id: mockId },
        auth: null
      },
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
          }
        }
      })
    )
  })

  describe('when requiresAuth is false', () => {
    it('should set auth: false in options', () => {
      const controller = getExemptionController({ requiresAuth: false })

      expect(controller.options.auth).toBe(false)
    })

    it('should return exemption when publicRegister consent is yes', async () => {
      const { mockMongo, mockHandler } = global

      vi.spyOn(mockMongo, 'collection').mockImplementation(() => {
        return {
          findOne: vi.fn().mockResolvedValue({
            _id: mockId,
            projectName: 'Test project',
            publicRegister: { consent: 'yes' }
          })
        }
      })

      await getExemptionController({ requiresAuth: false }).handler(
        {
          db: mockMongo,
          params: { id: mockId }
        },
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
            publicRegister: { consent: 'no' }
          })
        }
      })

      await expect(
        getExemptionController({ requiresAuth: false }).handler(
          {
            db: mockMongo,
            params: { id: mockId }
          },
          mockHandler
        )
      ).rejects.toThrow('Not authorized to request this resource')
    })
  })
})
