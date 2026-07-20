export const WFD_PRESIGNED_URL_EXPIRES_IN_SECONDS = 3600

export const buildWfdDocumentDownloadPathById = (id) =>
  `/public/marine-licence/${id}/water-framework-directive/download-url`

export const buildWfdDocumentDownloadUrlById = (backendGatewayUrl, id) =>
  `${backendGatewayUrl}${buildWfdDocumentDownloadPathById(id)}`

export const buildWaterFrameworkDirectiveDynamicsPayload = (
  waterFrameworkDirective,
  backendGatewayUrl,
  marineLicenceId
) => {
  const wfd = waterFrameworkDirective ?? {}
  const hasDocument = Boolean(wfd.s3Location?.s3Bucket && wfd.s3Location?.s3Key)

  return {
    nauticalMile: wfd.nauticalMile ?? null,
    excludedActivities: wfd.excludedActivities ?? null,
    documentUrl: hasDocument
      ? buildWfdDocumentDownloadUrlById(backendGatewayUrl, marineLicenceId)
      : null,
    fileName: hasDocument ? (wfd.uploadedFile?.filename ?? null) : null
  }
}
