import {
  SITE_NOTICE_PHOTO_FIELD_BY_TYPE,
  SITE_NOTICE_PHOTO_TYPE,
  buildSiteNoticePhotoDownloadPath,
  buildSiteNoticePhotoDownloadUrl
} from './site-notice-evidence.js'

describe('site-notice-evidence constants', () => {
  it('maps photo types to stored evidence fields', () => {
    expect(
      SITE_NOTICE_PHOTO_FIELD_BY_TYPE[SITE_NOTICE_PHOTO_TYPE.CLOSE_UP]
    ).toBe('closeUpPhoto')
    expect(
      SITE_NOTICE_PHOTO_FIELD_BY_TYPE[SITE_NOTICE_PHOTO_TYPE.POSITION]
    ).toBe('positionPhoto')
  })

  it('builds a download-url path with id, location number and photo type', () => {
    expect(
      buildSiteNoticePhotoDownloadPath(
        '507f1f77bcf86cd799439011',
        1,
        SITE_NOTICE_PHOTO_TYPE.CLOSE_UP
      )
    ).toBe(
      '/public/marine-licence/507f1f77bcf86cd799439011/site-notice-evidence/1/close-up/download-url'
    )
  })

  it('builds an absolute site notice photo download URL', () => {
    expect(
      buildSiteNoticePhotoDownloadUrl(
        'https://api.example.com',
        '507f1f77bcf86cd799439011',
        2,
        SITE_NOTICE_PHOTO_TYPE.POSITION
      )
    ).toBe(
      'https://api.example.com/public/marine-licence/507f1f77bcf86cd799439011/site-notice-evidence/2/position/download-url'
    )
  })
})
