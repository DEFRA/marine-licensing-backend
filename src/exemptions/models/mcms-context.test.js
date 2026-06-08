import { mcmsContext } from './mcms-context.js'
import {
  activityTypes,
  articleCodes
} from '../../shared/common/constants/mcms-context.js'

describe('mcmsContext validation schema', () => {
  const validMcmsContext = {
    activityType: activityTypes.CON.code,
    article: articleCodes[0],
    pdfDownloadUrl:
      'https://marinelicensing.marinemanagement.org.uk/path/journey/self-service/outcome-document/b87ae3f7-48f3-470d-b29b-5a5abfdaa49f',
    iatQueryString: 'test-query-string'
  }

  describe('when mcmsContext is not provided', () => {
    it('should validate when mcmsContext is null', () => {
      const result = mcmsContext.validate(null)
      expect(result.error).toBeUndefined()
      expect(result.value).toBeNull()
    })
  })

  describe('when mcmsContext is provided', () => {
    it('should validate with valid mcmsContext for CON activity type', () => {
      const result = mcmsContext.validate(validMcmsContext)
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual(validMcmsContext)
    })

    it('should validate with valid mcmsContext for DEPOSIT activity type', () => {
      const depositContext = {
        ...validMcmsContext,
        activityType: activityTypes.DEPOSIT.code
      }
      const result = mcmsContext.validate(depositContext)
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual(depositContext)
    })

    it('should validate with valid mcmsContext for REMOVAL activity type', () => {
      const removalContext = {
        ...validMcmsContext,
        activityType: activityTypes.REMOVAL.code
      }
      const result = mcmsContext.validate(removalContext)
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual(removalContext)
    })

    it('should validate with valid mcmsContext for DREDGE activity type', () => {
      const dredgeContext = {
        ...validMcmsContext,
        activityType: activityTypes.DREDGE.code
      }
      const result = mcmsContext.validate(dredgeContext)
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual(dredgeContext)
    })

    it('should validate with valid mcmsContext for INCINERATION activity type', () => {
      const incinerationContext = {
        ...validMcmsContext,
        activityType: activityTypes.INCINERATION.code
      }
      const result = mcmsContext.validate(incinerationContext)
      expect(result.error).toBeUndefined()
    })

    describe('activityType validation', () => {
      it('should fail with invalid activityType', () => {
        const invalidContext = {
          ...validMcmsContext,
          activityType: 'INVALID_TYPE'
        }
        const result = mcmsContext.validate(invalidContext)
        expect(result.error).toBeDefined()
        expect(result.error.message).toContain('must be one of')
      })

      it('should fail when activityType is missing', () => {
        const { activityType, ...contextWithoutActivityType } = validMcmsContext
        const result = mcmsContext.validate(contextWithoutActivityType)
        expect(result.error).toBeDefined()
        expect(result.error.message).toContain('"activityType" is required')
      })
    })

    describe('article validation', () => {
      it('should fail with invalid article', () => {
        const invalidContext = {
          ...validMcmsContext,
          article: 'INVALID_ARTICLE'
        }
        const result = mcmsContext.validate(invalidContext)
        expect(result.error).toBeDefined()
        expect(result.error.message).toContain('must be one of')
      })

      it('should fail when article is missing', () => {
        const { article, ...contextWithoutArticle } = validMcmsContext
        const result = mcmsContext.validate(contextWithoutArticle)
        expect(result.error).toBeDefined()
        expect(result.error.message).toContain('"article" is required')
      })

      it('should validate with all valid article codes', () => {
        articleCodes.forEach((code) => {
          const contextWithArticle = {
            ...validMcmsContext,
            article: code
          }
          const result = mcmsContext.validate(contextWithArticle)
          expect(result.error).toBeUndefined()
        })
      })
    })

    describe('pdfDownloadUrl validation', () => {
      it('should fail when pdfDownloadUrl is missing', () => {
        const { pdfDownloadUrl, ...contextWithoutUrl } = validMcmsContext
        const result = mcmsContext.validate(contextWithoutUrl)
        expect(result.error).toBeDefined()
        expect(result.error.message).toContain('"pdfDownloadUrl" is required')
      })

      it('should validate legacy and new self-hosted URL formats', () => {
        const newSlug = 'B'.repeat(22)
        const urls = [
          'https://marinelicensing.marinemanagement.org.uk/path/journey/self-service/outcome-document/b87ae3f7-48f3-470d-b29b-5a5abfdaa49f',
          'https://marinelicensingtest.marinemanagement.org.uk/path/journey/self-service/outcome-document/123',
          `https://get-permission-for-marine-work.defra.gov.uk/outcome-documents/${newSlug}`,
          `https://marine-licensing-frontend.dev.cdp-int.defra.cloud/outcome-documents/${newSlug}`,
          `https://marine-licensing-frontend.test.cdp-int.defra.cloud/outcome-documents/${newSlug}`,
          `https://marine-licensing-frontend.perf-test.cdp-int.defra.cloud/outcome-documents/${newSlug}`,
          `http://marine-licensing-frontend.local:3000/outcome-documents/${newSlug}`,
          `http://localhost:3000/outcome-documents/${newSlug}`,
          // base64url slug containing an underscore (regression for the old [a-zA-Z0-9-] charset)
          'https://get-permission-for-marine-work.defra.gov.uk/outcome-documents/ab_cd-EF1234567890123456'
        ]

        urls.forEach((url) => {
          const contextWithUrl = {
            ...validMcmsContext,
            pdfDownloadUrl: url
          }
          const result = mcmsContext.validate(contextWithUrl)
          expect(result.error).toBeUndefined()
        })
      })

      it('should fail with an unknown host', () => {
        const contextWithInvalidUrl = {
          ...validMcmsContext,
          pdfDownloadUrl: `https://evil.example.com/outcome-documents/${'B'.repeat(22)}`
        }
        const result = mcmsContext.validate(contextWithInvalidUrl)
        expect(result.error).toBeDefined()
      })

      it('should fail with an allowed host but a non-outcome-document path', () => {
        const contextWithInvalidUrl = {
          ...validMcmsContext,
          pdfDownloadUrl:
            'https://get-permission-for-marine-work.defra.gov.uk/not-a-document/123'
        }
        const result = mcmsContext.validate(contextWithInvalidUrl)
        expect(result.error).toBeDefined()
      })

      it('should fail with a non-outcome-document URL', () => {
        const contextWithInvalidUrl = {
          ...validMcmsContext,
          pdfDownloadUrl: 'https://test.com/test.pdf'
        }
        const result = mcmsContext.validate(contextWithInvalidUrl)
        expect(result.error).toBeDefined()
      })
    })

    describe('iatQueryString validation', () => {
      it('should fail when iatQueryString is missing', () => {
        const { iatQueryString, ...contextWithoutQueryString } =
          validMcmsContext
        const result = mcmsContext.validate(contextWithoutQueryString)
        expect(result.error).toBeDefined()
        expect(result.error.message).toContain('"iatQueryString" is required')
      })

      it('should validate with valid iatQueryString', () => {
        const contextWithQueryString = {
          ...validMcmsContext,
          iatQueryString: 'custom-query-string'
        }
        const result = mcmsContext.validate(contextWithQueryString)
        expect(result.error).toBeUndefined()
        expect(result.value.iatQueryString).toBe('custom-query-string')
      })
    })
  })
})
