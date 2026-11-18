import {
  buildSiteNoticeEvidenceDynamicsPayload,
  formatSiteNoticeEvidenceForGateway
} from './format-site-notice-evidence-for-gateway.js'

describe('formatSiteNoticeEvidenceForGateway', () => {
  const backendGatewayUrl = 'https://api.example.com'
  const marineLicenceId = '507f1f77bcf86cd799439011'

  const photo = (filename, s3Key) => ({
    uploadedFile: { filename },
    s3Location: {
      s3Bucket: 'mmo-uploads',
      s3Key,
      checksumSha256: 'abc123'
    }
  })

  it('returns an empty array when no site notice evidence is stored', () => {
    expect(formatSiteNoticeEvidenceForGateway()).toEqual([])
  })

  it('maps complete locations with durable download URLs', () => {
    expect(
      formatSiteNoticeEvidenceForGateway(
        [
          {
            locationName: 'North pier',
            dateDisplayed: { day: '18', month: '10', year: '2026' },
            closeUpPhoto: photo('close-up.jpg', 'site-notice/close-up'),
            positionPhoto: photo('position.jpg', 'site-notice/position')
          }
        ],
        backendGatewayUrl,
        marineLicenceId
      )
    ).toEqual([
      {
        locationNumber: 1,
        locationName: 'North pier',
        dateDisplayed: '18 October 2026',
        closeUpPhoto: {
          filename: 'close-up.jpg',
          downloadUrl: `${backendGatewayUrl}/public/marine-licence/${marineLicenceId}/site-notice-evidence/1/close-up/download-url`
        },
        positionPhoto: {
          filename: 'position.jpg',
          downloadUrl: `${backendGatewayUrl}/public/marine-licence/${marineLicenceId}/site-notice-evidence/1/position/download-url`
        }
      }
    ])
  })

  it('keeps empty slots so location numbers stay 1-based and stable', () => {
    expect(
      formatSiteNoticeEvidenceForGateway(
        [{}, { locationName: 'South pier' }],
        backendGatewayUrl,
        marineLicenceId
      )
    ).toEqual([
      {
        locationNumber: 1,
        locationName: null,
        dateDisplayed: null,
        closeUpPhoto: null,
        positionPhoto: null
      },
      {
        locationNumber: 2,
        locationName: 'South pier',
        dateDisplayed: null,
        closeUpPhoto: null,
        positionPhoto: null
      }
    ])
  })

  it('returns null for photos without a stored S3 location', () => {
    expect(
      formatSiteNoticeEvidenceForGateway(
        [
          {
            locationName: 'Harbour wall',
            closeUpPhoto: { uploadedFile: { filename: 'missing.jpg' } }
          }
        ],
        backendGatewayUrl,
        marineLicenceId
      )
    ).toEqual([
      {
        locationNumber: 1,
        locationName: 'Harbour wall',
        dateDisplayed: null,
        closeUpPhoto: null,
        positionPhoto: null
      }
    ])
  })

  it('returns null for an invalid dateDisplayed', () => {
    expect(
      formatSiteNoticeEvidenceForGateway(
        [
          {
            locationName: 'Harbour wall',
            dateDisplayed: { day: '31', month: '04', year: '2026' }
          }
        ],
        backendGatewayUrl,
        marineLicenceId
      )[0].dateDisplayed
    ).toBeNull()
  })
})

describe('buildSiteNoticeEvidenceDynamicsPayload', () => {
  const backendGatewayUrl = 'https://api.example.com'
  const marineLicenceId = '507f1f77bcf86cd799439011'

  it('includes locationCount and formatted locations', () => {
    expect(
      buildSiteNoticeEvidenceDynamicsPayload(
        [
          {
            locationName: 'North pier',
            dateDisplayed: { day: '18', month: '10', year: '2026' }
          },
          {}
        ],
        backendGatewayUrl,
        marineLicenceId
      )
    ).toEqual({
      locationCount: 2,
      locations: [
        {
          locationNumber: 1,
          locationName: 'North pier',
          dateDisplayed: '18 October 2026',
          closeUpPhoto: null,
          positionPhoto: null
        },
        {
          locationNumber: 2,
          locationName: null,
          dateDisplayed: null,
          closeUpPhoto: null,
          positionPhoto: null
        }
      ]
    })
  })

  it('returns a zero count when there is no evidence', () => {
    expect(
      buildSiteNoticeEvidenceDynamicsPayload(
        undefined,
        backendGatewayUrl,
        marineLicenceId
      )
    ).toEqual({ locationCount: 0, locations: [] })
  })
})
