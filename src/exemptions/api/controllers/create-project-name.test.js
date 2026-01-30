import { vi } from 'vitest'
import { createProjectNameController } from './create-project-name'
import { ObjectId } from 'mongodb'
import { EXEMPTION_STATUS } from '../../../shared/common/constants/exemption.js'
import { activityTypes } from '../../../shared/common/constants/mcms-context.js'

describe('POST /exemptions/project-name', () => {
  const payloadValidator = createProjectNameController.options.validate.payload
  const auth = { credentials: { contactId: new ObjectId().toHexString() } }
  const mockLogger = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
  const mockAuditPayload = {
    createdAt: new Date('2025-01-01T12:00:00Z'),
    createdBy: 'user123',
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    updatedBy: 'user123'
  }

  const pdfDownloadUrl =
    'https://marinelicensing.marinemanagement.org.uk/path/journey/self-service/outcome-document/b87ae3f7-48f3-470d-b29b-5a5abfdaa49f'

  const iatQueryString =
    '?ADV_TYPE=EXE&ARTICLE=25&outcomeType=WO_EXE_AVAILABLE_ARTICLE_17&pdfDownloadUrl=https://marinelicensing.marinemanagement.org.uk/path/journey/self-service/outcome-document/b87ae3f7-48f3-470d-b29b-5a5abfdaa49f&ACTIVITY_TYPE=CON&EXE_ACTIVITY_SUBTYPE_CON=scientificResearch'

  const mockMcmsContext = {
    mcmsContext: {
      activityType: activityTypes.CON.code,
      article: '25',
      pdfDownloadUrl,
      iatQueryString
    }
  }

  const setupMockInsertOne = (insertedId = new ObjectId()) => {
    const mockInsertOne = vi.fn().mockResolvedValue({ insertedId })
    vi.spyOn(global.mockMongo, 'collection').mockImplementation(function () {
      return { insertOne: mockInsertOne }
    })
    return mockInsertOne
  }

  let mockInsertOne

  beforeEach(() => (mockInsertOne = setupMockInsertOne()))

  describe('Validation', () => {
    it('should fail if fields are missing', () => {
      const result = payloadValidator.validate({})

      expect(result.error.message).toContain('PROJECT_NAME_REQUIRED')
    })

    it('should fail if name is empty string', () => {
      const result = payloadValidator.validate({
        projectName: ''
      })

      expect(result.error.message).toContain('PROJECT_NAME_REQUIRED')
    })

    it('should validate successfully with mcmsContext', () => {
      const result = payloadValidator.validate({
        projectName: 'Test Project',
        userRelationshipType: 'Citizen',
        ...mockMcmsContext
      })

      expect(result.error).toBeUndefined()
      expect(result.value.projectName).toBe('Test Project')
      expect(result.value.mcmsContext).toEqual(mockMcmsContext.mcmsContext)
    })

    it('should validate successfully if mcmsContext is undefined', () => {
      const result = payloadValidator.validate({
        projectName: 'Test Project',
        userRelationshipType: 'Citizen'
      })

      expect(result.error).toBeUndefined()
      expect(result.value.projectName).toBe('Test Project')
      expect(result.value.mcmsContext).toBeUndefined()
    })

    it('should validate successfully if mcmsContext is null', () => {
      const result = payloadValidator.validate({
        projectName: 'Test Project',
        userRelationshipType: 'Citizen',
        mcmsContext: null
      })

      expect(result.error).toBeUndefined()
      expect(result.value.projectName).toBe('Test Project')
      expect(result.value.mcmsContext).toBeNull()
    })
  })

  it('should create a new exemption with project name', async () => {
    const mockPayload = {
      projectName: 'Project',
      ...mockAuditPayload
    }
    const { mockMongo, mockHandler } = global

    await createProjectNameController.handler(
      { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'success'
      })
    )
  })

  it('should create a new exemption with project name and mcmsContext', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      projectName: 'Project with MCMS',
      ...mockAuditPayload,
      ...mockMcmsContext
    }

    await createProjectNameController.handler(
      { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'success'
      })
    )
  })

  it('should create exemption with correct status and type properties', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      projectName: 'Test Project',
      ...mockAuditPayload
    }

    await createProjectNameController.handler(
      { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
      mockHandler
    )

    expect(mockInsertOne).toHaveBeenCalledWith({
      projectName: 'Test Project',
      status: EXEMPTION_STATUS.DRAFT,
      contactId: expect.any(String),
      mcmsContext: null,
      ...mockAuditPayload
    })
  })

  it('should create exemption with mcmsContext when provided', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      projectName: 'Test Project with MCMS',
      ...mockAuditPayload,
      ...mockMcmsContext
    }

    await createProjectNameController.handler(
      { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
      mockHandler
    )

    expect(mockInsertOne).toHaveBeenCalledWith({
      projectName: 'Test Project with MCMS',
      status: EXEMPTION_STATUS.DRAFT,
      contactId: expect.any(String),
      mcmsContext: {
        activity: {
          code: 'CON',
          label: 'Construction',
          purpose: 'Moorings or aids to navigation'
        },
        articleCode: '25',
        pdfDownloadUrl,
        iatQueryString
      },
      ...mockAuditPayload
    })
  })

  describe('Organisations', () => {
    it('should save organisation data for an employee', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = {
        projectName: 'Test Project with Organisation',
        organisationId: 'org-123',
        organisationName: 'Test Organisation',
        userRelationshipType: 'Employee',
        ...mockAuditPayload
      }

      await createProjectNameController.handler(
        { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
        mockHandler
      )

      expect(mockInsertOne).toHaveBeenCalledWith({
        projectName: 'Test Project with Organisation',
        status: EXEMPTION_STATUS.DRAFT,
        contactId: expect.any(String),
        mcmsContext: null,
        organisation: {
          id: 'org-123',
          name: 'Test Organisation',
          userRelationshipType: 'Employee'
        },
        ...mockAuditPayload
      })
    })

    it('should not include organisation field when no organisation provided', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = {
        projectName: 'Test Project without Organisation',
        userRelationshipType: 'Citizen',
        ...mockAuditPayload
      }

      await createProjectNameController.handler(
        { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
        mockHandler
      )

      expect(mockInsertOne).toHaveBeenCalledWith({
        projectName: 'Test Project without Organisation',
        status: EXEMPTION_STATUS.DRAFT,
        contactId: expect.any(String),
        mcmsContext: null,
        ...mockAuditPayload
      })
    })

    it('should save organisation data for an intermediary / agent', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = {
        projectName: 'Test Project with Beneficiary',
        organisationId: 'org-456',
        organisationName: 'Test Beneficiary Org',
        userRelationshipType: 'Agent',
        ...mockAuditPayload
      }

      await createProjectNameController.handler(
        { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
        mockHandler
      )

      expect(mockInsertOne).toHaveBeenCalledWith({
        projectName: 'Test Project with Beneficiary',
        status: EXEMPTION_STATUS.DRAFT,
        contactId: expect.any(String),
        mcmsContext: null,
        organisation: {
          id: 'org-456',
          name: 'Test Beneficiary Org',
          userRelationshipType: 'Agent'
        },
        ...mockAuditPayload
      })
    })
  })

  it('should return an error message if the database operation fails', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      projectName: 'Project',
      ...mockAuditPayload
    }

    const mockError = 'Database failed'

    vi.spyOn(mockMongo, 'collection').mockImplementation(function () {
      return {
        insertOne: vi.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(
      async () =>
        await createProjectNameController.handler(
          { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
          mockHandler
        )
    ).rejects.toThrow(`Error creating project name for Exemption: ${mockError}`)
  })

  it('should throw unauthorized error when user is not authenticated', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      projectName: 'Project',
      ...mockAuditPayload
    }
    const invalidAuth = { credentials: {} }

    await expect(
      createProjectNameController.handler(
        {
          db: mockMongo,
          payload: mockPayload,
          auth: invalidAuth,
          logger: mockLogger
        },
        mockHandler
      )
    ).rejects.toThrow('User not authenticated')

    expect(mockInsertOne).not.toHaveBeenCalled()
  })

  it('should return response with 201 CREATED status code', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      projectName: 'Project',
      ...mockAuditPayload
    }

    await createProjectNameController.handler(
      { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
      mockHandler
    )

    expect(mockHandler.code).toHaveBeenCalledWith(201)
  })

  it('should return insertedId in response value', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      projectName: 'Project',
      ...mockAuditPayload
    }
    const testObjectId = new ObjectId()
    setupMockInsertOne(testObjectId)

    await createProjectNameController.handler(
      { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith({
      message: 'success',
      value: { id: testObjectId.toString() }
    })
  })

  it('should call collection with exemptions collection name', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      projectName: 'Project',
      ...mockAuditPayload
    }
    const collectionSpy = vi.spyOn(mockMongo, 'collection')

    await createProjectNameController.handler(
      { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
      mockHandler
    )

    expect(collectionSpy).toHaveBeenCalledWith('exemptions')
  })

  describe('MCMS Context Validation', () => {
    it('should info log and use iatQueryString when mcmsContext validation fails', async () => {
      const { mockMongo, mockHandler } = global
      const invalidMcmsContext = {
        activityType: 'INVALID',
        article: 'invalid',
        iatQueryString: 'test-query-string'
      }
      const mockPayload = {
        projectName: 'Project with invalid MCMS',
        mcmsContext: invalidMcmsContext,
        ...mockAuditPayload
      }

      await createProjectNameController.handler(
        { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
        mockHandler
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          mcmsContext: invalidMcmsContext,
          validationError: expect.stringContaining(
            '"activityType" must be one of'
          )
        },
        'Validation failed for MCMS context'
      )

      expect(mockInsertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          mcmsContext: {
            iatQueryString: 'test-query-string'
          }
        })
      )
    })

    it('should save values and not log when mcmsContext validation succeeds', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = {
        projectName: 'Project with valid MCMS',
        ...mockAuditPayload,
        ...mockMcmsContext
      }

      await createProjectNameController.handler(
        { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
        mockHandler
      )

      expect(mockLogger.error).not.toHaveBeenCalled()

      expect(mockInsertOne).toHaveBeenCalledWith({
        projectName: 'Project with valid MCMS',
        status: EXEMPTION_STATUS.DRAFT,
        contactId: expect.any(String),
        mcmsContext: {
          activity: {
            code: 'CON',
            label: 'Construction',
            purpose: 'Moorings or aids to navigation'
          },
          articleCode: '25',
          pdfDownloadUrl,
          iatQueryString
        },
        ...mockAuditPayload
      })
    })
  })
})
