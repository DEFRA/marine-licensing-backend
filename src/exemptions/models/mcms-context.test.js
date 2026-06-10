import { mcmsContext } from './mcms-context.js'
import {
  activityTypes,
  articleCodes
} from '../../shared/common/constants/mcms-context.js'
import { config } from '../../config.js'

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

      it('should validate legacy MCMS and configured-app-host URL formats', () => {
        const newSlug = 'B'.repeat(22)
        const urls = [
          'https://marinelicensing.marinemanagement.org.uk/path/journey/self-service/outcome-document/b87ae3f7-48f3-470d-b29b-5a5abfdaa49f',
          'https://marinelicensingtest.marinemanagement.org.uk/path/journey/self-service/outcome-document/123',
          `http://localhost:3000/journey/self-service/outcome-document/${newSlug}`,
          // base64url slug containing an underscore (regression for the old [a-zA-Z0-9-] charset)
          'http://localhost:3000/journey/self-service/outcome-document/ab_cd-EF1234567890123456'
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

      it('accepts an outcome-document URL on the host configured via frontEndBaseUrl', () => {
        const spy = vi
          .spyOn(config, 'get')
          .mockReturnValue(
            'https://get-permission-for-marine-work.defra.gov.uk'
          )
        const result = mcmsContext.validate({
          ...validMcmsContext,
          pdfDownloadUrl: `https://get-permission-for-marine-work.defra.gov.uk/journey/self-service/outcome-document/${'B'.repeat(22)}`
        })
        expect(result.error).toBeUndefined()
        spy.mockRestore()
      })

      it('rejects the removed /outcome-documents/{slug} path on the app host', () => {
        const result = mcmsContext.validate({
          ...validMcmsContext,
          pdfDownloadUrl: `http://localhost:3000/outcome-documents/${'B'.repeat(22)}`
        })
        expect(result.error).toBeDefined()
      })

      it('should fail with an unknown host', () => {
        const result = mcmsContext.validate({
          ...validMcmsContext,
          pdfDownloadUrl: `https://evil.example.com/journey/self-service/outcome-document/${'B'.repeat(22)}`
        })
        expect(result.error).toBeDefined()
      })

      it('rejects the app host with a non-outcome-document path', () => {
        const result = mcmsContext.validate({
          ...validMcmsContext,
          pdfDownloadUrl: 'http://localhost:3000/not-a-document/123'
        })
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

      it('should fail when pdfDownloadUrl is not a parseable URL', () => {
        const result = mcmsContext.validate({
          ...validMcmsContext,
          pdfDownloadUrl: 'not-a-valid-url'
        })
        expect(result.error).toBeDefined()
      })

      it('rejects a legacy MCMS host served over http instead of https', () => {
        const result = mcmsContext.validate({
          ...validMcmsContext,
          pdfDownloadUrl:
            'http://marinelicensing.marinemanagement.org.uk/path/journey/self-service/outcome-document/123'
        })
        expect(result.error).toBeDefined()
      })

      it('rejects a legacy MCMS host with a non-outcome-document path', () => {
        const result = mcmsContext.validate({
          ...validMcmsContext,
          pdfDownloadUrl:
            'https://marinelicensing.marinemanagement.org.uk/not-a-document/123'
        })
        expect(result.error).toBeDefined()
      })

      it('rejects the app host served over a non-http(s) protocol', () => {
        const result = mcmsContext.validate({
          ...validMcmsContext,
          pdfDownloadUrl: `ftp://localhost:3000/journey/self-service/outcome-document/${'B'.repeat(22)}`
        })
        expect(result.error).toBeDefined()
      })

      it('rejects the URL when frontEndBaseUrl is misconfigured', () => {
        const spy = vi.spyOn(config, 'get').mockReturnValue('not a url')
        const result = mcmsContext.validate({
          ...validMcmsContext,
          pdfDownloadUrl: `https://example.com/journey/self-service/outcome-document/${'B'.repeat(22)}`
        })
        expect(result.error).toBeDefined()
        spy.mockRestore()
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
