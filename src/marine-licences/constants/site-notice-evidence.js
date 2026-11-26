export const SITE_NOTICE_PHOTO_PRESIGNED_URL_EXPIRES_IN_SECONDS = 3600

export const SITE_NOTICE_PHOTO_TYPE = {
  CLOSE_UP: 'close-up',
  POSITION: 'position'
}

export const SITE_NOTICE_PHOTO_FIELD_BY_TYPE = {
  [SITE_NOTICE_PHOTO_TYPE.CLOSE_UP]: 'closeUpPhoto',
  [SITE_NOTICE_PHOTO_TYPE.POSITION]: 'positionPhoto'
}

export const buildSiteNoticePhotoDownloadPath = (
  id,
  locationNumber,
  photoType
) =>
  `/public/marine-licence/${id}/site-notice-evidence/${locationNumber}/${photoType}/download-url`

export const buildSiteNoticePhotoDownloadUrl = (
  backendGatewayUrl,
  id,
  locationNumber,
  photoType
) =>
  `${backendGatewayUrl}${buildSiteNoticePhotoDownloadPath(id, locationNumber, photoType)}`
