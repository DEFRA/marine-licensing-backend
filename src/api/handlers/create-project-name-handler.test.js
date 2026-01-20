import { vi } from 'vitest'
import { createProjectNameHandler } from './create-project-name-handler.js'
import { ObjectId } from 'mongodb'
import { activityTypes } from '../../common/constants/mcms-context.js'

describe('createProjectNameHandler', () => {
  const mockLogger = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
  const auth = { credentials: { contactId: new ObjectId().toHexString() } }
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
  const collectionName = 'test-collection'
  const status = 'DRAFT'
  const entityType = 'Test Entity'
  const handler = createProjectNameHandler({
    collectionName,
    status,
    entityType
  })

  beforeEach(() => (mockInsertOne = setupMockInsertOne()))

  it('should create a new record with project name', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      projectName: 'Project',
      ...mockAuditPayload
    }

    await handler(
      { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'success'
      })
    )
  })

  it('should create record with correct status and collection', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      projectName: 'Test Project',
      ...mockAuditPayload
    }

    await handler(
      { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
      mockHandler
    )

    expect(mockInsertOne).toHaveBeenCalledWith({
      projectName: 'Test Project',
      status,
      contactId: expect.any(String),
      mcmsContext: null,
      ...mockAuditPayload
    })

    expect(global.mockMongo.collection).toHaveBeenCalledWith(collectionName)
  })

  it('should create record with mcmsContext when provided', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      projectName: 'Test Project with MCMS',
      ...mockAuditPayload,
      ...mockMcmsContext
    }

    await handler(
      { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
      mockHandler
    )

    expect(mockInsertOne).toHaveBeenCalledWith({
      projectName: 'Test Project with MCMS',
      status,
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
    it('should save organisation data when provided', async () => {
      const { mockMongo, mockHandler } = global
      const mockPayload = {
        projectName: 'Test Project with Organisation',
        organisationId: 'org-123',
        organisationName: 'Test Organisation',
        userRelationshipType: 'Employee',
        ...mockAuditPayload
      }

      await handler(
        { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
        mockHandler
      )

      expect(mockInsertOne).toHaveBeenCalledWith({
        projectName: 'Test Project with Organisation',
        status,
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

      await handler(
        { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
        mockHandler
      )

      expect(mockInsertOne).toHaveBeenCalledWith({
        projectName: 'Test Project without Organisation',
        status,
        contactId: expect.any(String),
        mcmsContext: null,
        ...mockAuditPayload
      })
      expect(mockInsertOne).toHaveBeenCalledWith(
        expect.not.objectContaining({
          organisation: expect.anything()
        })
      )
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
      handler(
        { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
        mockHandler
      )
    ).rejects.toThrow(
      `Error creating project name for ${entityType}: ${mockError}`
    )
  })

  it('should throw unauthorized error when user is not authenticated', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      projectName: 'Project',
      ...mockAuditPayload
    }
    const invalidAuth = { credentials: {} }
    const collectionSpy = vi.spyOn(mockMongo, 'collection')

    await expect(
      handler(
        {
          db: mockMongo,
          payload: mockPayload,
          auth: invalidAuth,
          logger: mockLogger
        },
        mockHandler
      )
    ).rejects.toThrow('User not authenticated')

    expect(collectionSpy).not.toHaveBeenCalled()
  })

  it('should return response with 201 CREATED status code', async () => {
    const { mockMongo, mockHandler } = global
    const mockPayload = {
      projectName: 'Project',
      ...mockAuditPayload
    }

    await handler(
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

    await handler(
      { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith({
      message: 'success',
      value: { id: testObjectId.toString() }
    })
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

      await handler(
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

      await handler(
        { db: mockMongo, payload: mockPayload, auth, logger: mockLogger },
        mockHandler
      )

      expect(mockLogger.error).not.toHaveBeenCalled()

      expect(mockInsertOne).toHaveBeenCalledWith({
        projectName: 'Project with valid MCMS',
        status,
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
