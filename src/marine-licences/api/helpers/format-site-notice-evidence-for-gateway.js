import { format } from 'date-fns'
import {
  SITE_NOTICE_PHOTO_TYPE,
  buildSiteNoticePhotoDownloadUrl
} from '../../constants/site-notice-evidence.js'
import { isRealDate, toDate } from '../../models/date-utils.js'

const DATE_DISPLAYED_FORMAT = 'd MMMM yyyy'

const hasStoredPhoto = (photo) =>
  Boolean(photo?.s3Location?.s3Bucket && photo?.s3Location?.s3Key)

const formatDateDisplayed = (dateDisplayed) => {
  if (!dateDisplayed || !isRealDate(dateDisplayed)) {
    return null
  }

  return format(toDate(dateDisplayed), DATE_DISPLAYED_FORMAT)
}

const formatPhoto = (
  photo,
  backendGatewayUrl,
  marineLicenceId,
  locationNumber,
  photoType
) => {
  if (!hasStoredPhoto(photo)) {
    return null
  }

  return {
    filename: photo.uploadedFile?.filename ?? null,
    downloadUrl: buildSiteNoticePhotoDownloadUrl(
      backendGatewayUrl,
      marineLicenceId,
      locationNumber,
      photoType
    )
  }
}

export const formatSiteNoticeEvidenceForGateway = (
  siteNoticeEvidence,
  backendGatewayUrl,
  marineLicenceId
) =>
  (siteNoticeEvidence ?? []).map((evidence, index) => {
    const location = evidence ?? {}
    const locationNumber = index + 1

    return {
      locationNumber,
      locationName: location.locationName ?? null,
      dateDisplayed: formatDateDisplayed(location.dateDisplayed),
      closeUpPhoto: formatPhoto(
        location.closeUpPhoto,
        backendGatewayUrl,
        marineLicenceId,
        locationNumber,
        SITE_NOTICE_PHOTO_TYPE.CLOSE_UP
      ),
      positionPhoto: formatPhoto(
        location.positionPhoto,
        backendGatewayUrl,
        marineLicenceId,
        locationNumber,
        SITE_NOTICE_PHOTO_TYPE.POSITION
      )
    }
  })

export const buildSiteNoticeEvidenceDynamicsPayload = (
  siteNoticeEvidence,
  backendGatewayUrl,
  marineLicenceId
) => {
  const locations = formatSiteNoticeEvidenceForGateway(
    siteNoticeEvidence,
    backendGatewayUrl,
    marineLicenceId
  )

  return {
    locationCount: locations.length,
    locations
  }
}
