import {
  buildWfdDocumentDownloadPathById,
  buildWfdDocumentDownloadUrlById,
  buildWaterFrameworkDirectiveDynamicsPayload
} from './water-framework-directive.js'

describe('water-framework-directive constants', () => {
  it('builds a download-url path with the marine licence id', () => {
    expect(buildWfdDocumentDownloadPathById('507f1f77bcf86cd799439011')).toBe(
      '/public/marine-licence/507f1f77bcf86cd799439011/water-framework-directive/download-url'
    )
  })

  it('builds an absolute WFD document download URL', () => {
    expect(
      buildWfdDocumentDownloadUrlById(
        'https://api.example.com',
        '507f1f77bcf86cd799439011'
      )
    ).toBe(
      'https://api.example.com/public/marine-licence/507f1f77bcf86cd799439011/water-framework-directive/download-url'
    )
  })

  describe('buildWaterFrameworkDirectiveDynamicsPayload', () => {
    const backendGatewayUrl = 'https://api.example.com'
    const marineLicenceId = '507f1f77bcf86cd799439011'

    it('returns null answer and document fields when WFD is missing', () => {
      expect(
        buildWaterFrameworkDirectiveDynamicsPayload(
          undefined,
          backendGatewayUrl,
          marineLicenceId
        )
      ).toEqual({
        nauticalMile: null,
        excludedActivities: null,
        documentUrl: null,
        fileName: null
      })
    })

    it('includes answered fields and nulls for unanswered fields', () => {
      expect(
        buildWaterFrameworkDirectiveDynamicsPayload(
          { nauticalMile: 'yes' },
          backendGatewayUrl,
          marineLicenceId
        )
      ).toEqual({
        nauticalMile: 'yes',
        excludedActivities: null,
        documentUrl: null,
        fileName: null
      })
    })

    it('includes document URL and full file name when a file is present', () => {
      expect(
        buildWaterFrameworkDirectiveDynamicsPayload(
          {
            nauticalMile: 'yes',
            excludedActivities: 'no',
            uploadedFile: { filename: 'wfd-assessment.odt' },
            s3Location: {
              s3Bucket: 'mmo-uploads',
              s3Key: 'exemptions/file-id'
            }
          },
          backendGatewayUrl,
          marineLicenceId
        )
      ).toEqual({
        nauticalMile: 'yes',
        excludedActivities: 'no',
        documentUrl: `https://api.example.com/public/marine-licence/${marineLicenceId}/water-framework-directive/download-url`,
        fileName: 'wfd-assessment.odt'
      })
    })
  })
})
