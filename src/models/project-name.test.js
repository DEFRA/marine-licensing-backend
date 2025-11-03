import {
  projectName,
  createProjectName,
  updateProjectName
} from './project-name.js'
import {
  activityTypes,
  articleCodes,
  validActivitySubtypes
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

    describe('when mcmsContext is not provided', () => {
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
    })

    describe('when mcmsContext is provided', () => {
      const validMcmsContext = {
        activityType: activityTypes.CON.code,
        article: articleCodes[0],
        pdfDownloadUrl:
          'https://marinelicensing.marinemanagement.org.uk/path/journey/self-service/outcome-document/b87ae3f7-48f3-470d-b29b-5a5abfdaa49f',
        activitySubtype: validActivitySubtypes[0]
      }

      it('should validate with valid mcmsContext for CON activity type', () => {
        const result = createProjectName.validate({
          ...validPayload,
          mcmsContext: validMcmsContext
        })
        expect(result.error).toBeUndefined()
        expect(result.value.mcmsContext).toEqual(validMcmsContext)
      })

      it('should validate with valid mcmsContext for DEPOSIT activity type', () => {
        const depositContext = {
          ...validMcmsContext,
          activityType: activityTypes.DEPOSIT.code
        }
        const result = createProjectName.validate({
          ...validPayload,
          mcmsContext: depositContext
        })
        expect(result.error).toBeUndefined()
        expect(result.value.mcmsContext).toEqual(depositContext)
      })

      it('should validate with valid mcmsContext for REMOVAL activity type', () => {
        const removalContext = {
          ...validMcmsContext,
          activityType: activityTypes.REMOVAL.code
        }
        const result = createProjectName.validate({
          ...validPayload,
          mcmsContext: removalContext
        })
        expect(result.error).toBeUndefined()
        expect(result.value.mcmsContext).toEqual(removalContext)
      })

      it('should validate with valid mcmsContext for DREDGE activity type', () => {
        const dredgeContext = {
          ...validMcmsContext,
          activityType: activityTypes.DREDGE.code
        }
        const result = createProjectName.validate({
          ...validPayload,
          mcmsContext: dredgeContext
        })
        expect(result.error).toBeUndefined()
        expect(result.value.mcmsContext).toEqual(dredgeContext)
      })

      it('should validate without activitySubtype for non-required activity types', () => {
        const { activitySubtype, ...contextWithoutSubtype } = validMcmsContext
        const incinerationContext = {
          ...contextWithoutSubtype,
          activityType: activityTypes.INCINERATION.code
        }
        const result = createProjectName.validate({
          ...validPayload,
          mcmsContext: incinerationContext
        })
        expect(result.error).toBeUndefined()
        expect(result.value.mcmsContext.activitySubtype).toBeUndefined()
      })

      describe('activityType validation', () => {
        it('should fail with invalid activityType', () => {
          const invalidContext = {
            ...validMcmsContext,
            activityType: 'INVALID_TYPE'
          }
          const result = createProjectName.validate({
            ...validPayload,
            mcmsContext: invalidContext
          })
          expect(result.error).toBeDefined()
          expect(result.error.message).toContain('must be one of')
        })

        it('should fail when activityType is missing', () => {
          const { activityType, ...contextWithoutActivityType } =
            validMcmsContext
          const result = createProjectName.validate({
            ...validPayload,
            mcmsContext: contextWithoutActivityType
          })
          expect(result.error).toBeDefined()
          expect(result.error.message).toContain(
            '"mcmsContext.activityType" is required'
          )
        })
      })

      describe('article validation', () => {
        it('should fail with invalid article', () => {
          const invalidContext = {
            ...validMcmsContext,
            article: 'INVALID_ARTICLE'
          }
          const result = createProjectName.validate({
            ...validPayload,
            mcmsContext: invalidContext
          })
          expect(result.error).toBeDefined()
          expect(result.error.message).toContain('must be one of')
        })

        it('should fail when article is missing', () => {
          const { article, ...contextWithoutArticle } = validMcmsContext
          const result = createProjectName.validate({
            ...validPayload,
            mcmsContext: contextWithoutArticle
          })
          expect(result.error).toBeDefined()
          expect(result.error.message).toContain(
            '"mcmsContext.article" is required'
          )
        })

        it('should validate with all valid article codes', () => {
          articleCodes.forEach((code) => {
            const contextWithArticle = {
              ...validMcmsContext,
              article: code
            }
            const result = createProjectName.validate({
              ...validPayload,
              mcmsContext: contextWithArticle
            })
            expect(result.error).toBeUndefined()
          })
        })
      })

      describe('pdfDownloadUrl validation', () => {
        it('should fail when pdfDownloadUrl is missing', () => {
          const { pdfDownloadUrl, ...contextWithoutUrl } = validMcmsContext
          const result = createProjectName.validate({
            ...validPayload,
            mcmsContext: contextWithoutUrl
          })
          expect(result.error).toBeDefined()
          expect(result.error.message).toContain(
            '"mcmsContext.pdfDownloadUrl" is required'
          )
        })

        it('should validate with different valid URL formats', () => {
          const urls = [
            'https://marinelicensing.marinemanagement.org.uk/path/journey/self-service/outcome-document/b87ae3f7-48f3-470d-b29b-5a5abfdaa49f',
            'https://marinelicensingtest.marinemanagement.org.uk/path/journey/self-service/outcome-document/123'
          ]

          urls.forEach((url) => {
            const contextWithUrl = {
              ...validMcmsContext,
              pdfDownloadUrl: url
            }
            const result = createProjectName.validate({
              ...validPayload,
              mcmsContext: contextWithUrl
            })
            expect(result.error).toBeUndefined()
          })
        })

        it('should fail with invalid URL format', () => {
          const contextWithInvalidUrl = {
            ...validMcmsContext,
            pdfDownloadUrl: 'https://test.com/test.pdf'
          }
          const result = createProjectName.validate({
            ...validPayload,
            mcmsContext: contextWithInvalidUrl
          })
          expect(result.error).toBeDefined()
          expect(result.error.message).toContain(
            '"mcmsContext.pdfDownloadUrl" with value "https://test.com/test.pdf" fails to match the required pattern: /^https:\\/\\/[^/]+\\.marinemanagement\\.org\\.uk\\/[^/]+\\/journey\\/self-service\\/outcome-document\\/[a-zA-Z0-9-]+$/'
          )
        })
      })

      describe('activitySubtype validation', () => {
        const activityTypesRequiringSubtype = [
          activityTypes.CON.code,
          activityTypes.DEPOSIT.code,
          activityTypes.REMOVAL.code,
          activityTypes.DREDGE.code
        ]

        const activityTypesNotRequiringSubtype = [
          activityTypes.INCINERATION.code,
          activityTypes.EXPLOSIVES.code,
          activityTypes.SCUTTLING.code
        ]

        activityTypesRequiringSubtype.forEach((type) => {
          it(`should require activitySubtype for ${type} activity type`, () => {
            const { activitySubtype, ...contextWithoutSubtype } =
              validMcmsContext
            const contextRequiringSubtype = {
              ...contextWithoutSubtype,
              activityType: type
            }
            const result = createProjectName.validate({
              ...validPayload,
              mcmsContext: contextRequiringSubtype
            })
            expect(result.error).toBeDefined()
            expect(result.error.message).toContain(
              '"mcmsContext.activitySubtype" is required'
            )
          })

          it(`should validate with valid activitySubtype for ${type} activity type`, () => {
            validActivitySubtypes.forEach((subtype) => {
              const contextWithSubtype = {
                ...validMcmsContext,
                activityType: type,
                activitySubtype: subtype
              }
              const result = createProjectName.validate({
                ...validPayload,
                mcmsContext: contextWithSubtype
              })
              expect(result.error).toBeUndefined()
            })
          })

          it(`should fail with invalid activitySubtype for ${type} activity type`, () => {
            const contextWithInvalidSubtype = {
              ...validMcmsContext,
              activityType: type,
              activitySubtype: 'INVALID_SUBTYPE'
            }
            const result = createProjectName.validate({
              ...validPayload,
              mcmsContext: contextWithInvalidSubtype
            })
            expect(result.error).toBeDefined()
            expect(result.error.message).toContain('must be one of')
          })
        })

        activityTypesNotRequiringSubtype.forEach((type) => {
          it(`should forbid activitySubtype for ${type} activity type`, () => {
            const contextWithForbiddenSubtype = {
              ...validMcmsContext,
              activityType: type,
              activitySubtype: validActivitySubtypes[0]
            }
            const result = createProjectName.validate({
              ...validPayload,
              mcmsContext: contextWithForbiddenSubtype
            })
            expect(result.error).toBeDefined()
            expect(result.error.message).toContain(
              '"mcmsContext.activitySubtype" is not allowed'
            )
          })
        })
      })
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
          activitySubtype: validActivitySubtypes[0]
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
