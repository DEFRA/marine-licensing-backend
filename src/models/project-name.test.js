import {
  projectName,
  createProjectName,
  updateProjectName
} from './project-name.js'
import {
  activityTypes,
  articleCodes
} from '../common/constants/mcms-context.js'

describe('Project name validation schemas', () => {
  describe('projectName schema', () => {
    it('should validate when projectName is a valid string', () => {
      const result = projectName.validate({
        projectName: 'Valid Project Name'
      })
      expect(result.error).toBeUndefined()
      expect(result.value.projectName).toBe('Valid Project Name')
    })

    it('should fail when projectName is missing', () => {
      const result = projectName.validate({})
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('PROJECT_NAME_REQUIRED')
    })

    it('should fail when projectName is empty string', () => {
      const result = projectName.validate({ projectName: '' })
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('PROJECT_NAME_REQUIRED')
    })

    it('should fail when projectName is too long', () => {
      const longProjectName = 'a'.repeat(251)
      const result = projectName.validate({ projectName: longProjectName })
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('PROJECT_NAME_MAX_LENGTH')
    })

    it('should fail when projectName is not a string', () => {
      const result = projectName.validate({ projectName: 123 })
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('"projectName" must be a string')
    })
  })

  describe('createProjectName schema', () => {
    const validPayload = {
      projectName: 'Valid Project Name',
      userRelationshipType: 'Citizen'
    }

    it('should validate without mcmsContext', () => {
      const result = createProjectName.validate(validPayload)
      expect(result.error).toBeUndefined()
      expect(result.value.projectName).toBe('Valid Project Name')
    })

    it('should validate when mcmsContext is null', () => {
      const result = createProjectName.validate({
        ...validPayload,
        mcmsContext: null
      })
      expect(result.error).toBeUndefined()
      expect(result.value.mcmsContext).toBeNull()
    })

    it('should validate when mcmsContext is an object', () => {
      const result = createProjectName.validate({
        ...validPayload,
        mcmsContext: {
          activityType: activityTypes.CON.code,
          article: articleCodes[0],
          pdfDownloadUrl:
            'https://marinelicensing.marinemanagement.org.uk/path/journey/self-service/outcome-document/b87ae3f7-48f3-470d-b29b-5a5abfdaa49f',
          iatQueryString: 'test-query-string'
        }
      })
      expect(result.error).toBeUndefined()
    })

    describe('when organisation fields are provided', () => {
      it('should validate with organisationId and organisationName', () => {
        const result = createProjectName.validate({
          ...validPayload,
          organisationId: 'org-456',
          organisationName: 'Example Organisation'
        })
        expect(result.error).toBeUndefined()
        expect(result.value.organisationId).toBe('org-456')
        expect(result.value.organisationName).toBe('Example Organisation')
      })

      it('should validate with organisationId and organisationName plus mcmsContext', () => {
        const validMcmsContext = {
          activityType: activityTypes.CON.code,
          article: articleCodes[0],
          pdfDownloadUrl:
            'https://marinelicensing.marinemanagement.org.uk/path/journey/self-service/outcome-document/b87ae3f7-48f3-470d-b29b-5a5abfdaa49f',
          iatQueryString: 'test-query-string'
        }

        const result = createProjectName.validate({
          ...validPayload,
          organisationId: 'org-789',
          organisationName: 'Test Organisation with MCMS',
          mcmsContext: validMcmsContext
        })
        expect(result.error).toBeUndefined()
        expect(result.value.organisationId).toBe('org-789')
        expect(result.value.organisationName).toBe(
          'Test Organisation with MCMS'
        )
        expect(result.value.mcmsContext).toEqual(validMcmsContext)
      })

      it('should fail when organisationId is provided without organisationName', () => {
        const result = createProjectName.validate({
          projectName: 'Test Project',
          organisationId: 'org-123'
        })
        expect(result.error).toBeDefined()
        expect(result.error.message).toBe('ORGANISATION_NAME_REQUIRED')
      })

      it('should validate with both organisationId and organisationName', () => {
        const result = createProjectName.validate({
          projectName: 'Test Project',
          organisationId: 'org-123',
          organisationName: 'Test Organisation Ltd',
          userRelationshipType: 'Citizen'
        })
        expect(result.error).toBeUndefined()
        expect(result.value.organisationId).toBe('org-123')
        expect(result.value.organisationName).toBe('Test Organisation Ltd')
      })

      it('should fail when organisationId is empty string', () => {
        const result = createProjectName.validate({
          projectName: 'Test Project',
          organisationId: ''
        })
        expect(result.error).toBeDefined()
        expect(result.error.message).toBe('ORGANISATION_ID_REQUIRED')
      })

      it('should fail when organisationName is required but missing', () => {
        const result = createProjectName.validate({
          projectName: 'Test Project',
          organisationId: 'org-123'
        })
        expect(result.error).toBeDefined()
        expect(result.error.message).toBe('ORGANISATION_NAME_REQUIRED')
      })

      it('should fail when organisationName is empty string but organisationId is provided', () => {
        const result = createProjectName.validate({
          projectName: 'Test Project',
          organisationId: 'org-123',
          organisationName: ''
        })
        expect(result.error).toBeDefined()
        expect(result.error.message).toBe('ORGANISATION_NAME_REQUIRED')
      })

      it('should validate when organisationName is any length', () => {
        const maxLengthOrgName = 'a'.repeat(200)
        const result = createProjectName.validate({
          projectName: 'Test Project',
          organisationId: 'org-123',
          organisationName: maxLengthOrgName,
          userRelationshipType: 'Citizen'
        })
        expect(result.error).toBeUndefined()
        expect(result.value.organisationName).toBe(maxLengthOrgName)
      })

      it('should fail when userRelationshipType is not valid', () => {
        const result = createProjectName.validate({
          projectName: 'Test Project',
          organisationId: 'org-123',
          organisationName: 'Test Organisation Ltd',
          userRelationshipType: 'INVALID_TYPE'
        })
        expect(result.error).toBeDefined()
        expect(result.error.message).toBe(
          '"userRelationshipType" must be one of [Employee, Agent, Citizen]'
        )
      })
    })
  })

  describe('updateProjectName schema', () => {
    it('should validate with valid projectName and id', () => {
      const validPayload = {
        projectName: 'Updated Project Name',
        id: '507f1f77bcf86cd799439011'
      }
      const result = updateProjectName.validate(validPayload)
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual(validPayload)
    })

    it('should fail when id is missing', () => {
      const result = updateProjectName.validate({ projectName: 'Test' })
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('EXEMPTION_ID_REQUIRED')
    })
  })
})
