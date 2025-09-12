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
    it('should validate when projectName contains no letters', () => {
      const validName = '1234-_/()[]:,.&@#!?+*%$'
      const result = projectName.validate({ projectName: validName })
      expect(result.error).toBeUndefined()
      expect(result.value.projectName).toBe(validName)
    })

    it('should validate when projectName is exactly 250 characters', () => {
      const maxLengthProjectName = '1'.repeat(250)
      const result = projectName.validate({ projectName: maxLengthProjectName })
      expect(result.error).toBeUndefined()
      expect(result.value.projectName).toBe(maxLengthProjectName)
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
      const longProjectName = '1'.repeat(251)
      const result = projectName.validate({ projectName: longProjectName })
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('PROJECT_NAME_MAX_LENGTH')
    })

    it('should fail when projectName is not a string', () => {
      const result = projectName.validate({ projectName: 123 })
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('"projectName" must be a string')
    })

    it('should fail when projectName contains any letters', () => {
      const result = projectName.validate({ projectName: 'Project 123' })
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('PROJECT_NAME_NO_LETTERS')
    })
  })

  describe('createProjectName schema', () => {
    const validPayload = {
      projectName: '12345-_/()[]:,'
    }

    describe('when mcmsContext is not provided', () => {
      it('should validate without mcmsContext', () => {
        const result = createProjectName.validate(validPayload)
        expect(result.error).toBeUndefined()
        expect(result.value.projectName).toBe('12345-_/()[]:,')
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
        activityType: activityTypes.CON,
        article: articleCodes[0],
        pdfDownloadUrl: 'https://example.com/test.pdf',
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
          activityType: activityTypes.DEPOSIT
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
          activityType: activityTypes.REMOVAL
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
          activityType: activityTypes.DREDGE
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
          activityType: activityTypes.INCINERATION
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

        it('should validate with different URL formats', () => {
          const urls = [
            'https://example.com/test.pdf',
            'http://example.com/test.pdf',
            'https://subdomain.example.com/path/to/file.pdf'
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
      })

      describe('activitySubtype validation', () => {
        const activityTypesRequiringSubtype = [
          activityTypes.CON,
          activityTypes.DEPOSIT,
          activityTypes.REMOVAL,
          activityTypes.DREDGE
        ]

        const activityTypesNotRequiringSubtype = [
          activityTypes.INCINERATION,
          activityTypes.EXPLOSIVES,
          activityTypes.SCUTTLING
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
  })

  describe('updateProjectName schema', () => {
    it('should validate with valid projectName and id', () => {
      const validPayload = {
        projectName: '12345-_/()',
        id: '507f1f77bcf86cd799439011'
      }
      const result = updateProjectName.validate(validPayload)
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual(validPayload)
    })

    it('should fail when id is missing', () => {
      const result = updateProjectName.validate({ projectName: '12345-_/()' })
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe('EXEMPTION_ID_REQUIRED')
    })
  })
})
