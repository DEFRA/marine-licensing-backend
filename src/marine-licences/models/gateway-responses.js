import joi from 'joi'

export const nullableString = joi.string().allow('', null)

const answerWithDetails = (answerKey, label) =>
  joi
    .object({ [answerKey]: nullableString, details: nullableString })
    .unknown(true)
    .allow(null)
    .label(label)

const gatewayActivitySchema = joi
  .object({
    activityIndex: joi.number().integer().required(),
    activityType: nullableString.required(),
    activitySubType: nullableString.required(),
    subActivities: joi.array().items(joi.string()).required(),
    otherActivity: nullableString.required(),
    activityDescription: nullableString.required(),
    activityDuration: nullableString.required(),
    activityMonths: joi
      .object({ applicable: nullableString, details: nullableString })
      .required(),
    completionDate: joi
      .object({ hasSpecificDate: nullableString, reason: nullableString })
      .required(),
    workingHours: nullableString.required()
  })
  .label('GatewayActivity')

const gatewaySiteSchema = joi
  .object({
    siteIndex: joi.number().integer().required(),
    siteName: nullableString.required(),
    locationMethod: nullableString.required(),
    coordinatesEntry: nullableString.required(),
    coordinateSystem: nullableString.required(),
    uploadedFile: joi
      .object({
        filename: joi.string().required(),
        fileType: nullableString,
        presignedFileUrl: nullableString
      })
      .allow(null)
      .required()
      .label('GatewayUploadedFile'),
    circleWidthMetres: joi.number().allow(null).required(),
    geometry: joi
      .object({
        type: joi.string().valid('FeatureCollection').required(),
        crs: joi.object().unknown(true),
        features: joi.array().items(joi.object().unknown(true)).required()
      })
      .allow(null)
      .required()
      .label('GatewaySiteGeometry'),
    activities: joi.array().items(gatewayActivitySchema).required()
  })
  .label('GatewaySite')

const gatewayMarinePlanPolicySchema = joi
  .object({
    policyCode: nullableString.required(),
    policyInformation: nullableString.required(),
    applicantAnswer: nullableString.required()
  })
  .label('GatewayMarinePlanPolicy')

const gatewayWaterFrameworkDirectiveSchema = joi
  .object({
    nauticalMile: nullableString.required(),
    excludedActivities: nullableString.required(),
    documentUrl: joi.string().uri().allow(null).required(),
    fileName: nullableString.required()
  })
  .label('GatewayWaterFrameworkDirective')

export const marineLicenceGatewayResponseSchema = joi
  .object({
    projectName: nullableString.required(),
    projectBackground: nullableString.required(),
    preferredLicenceDates: nullableString.required(),
    publicRegister: joi
      .object({ withholdConsent: nullableString, reason: nullableString })
      .unknown(true)
      .allow(null)
      .required()
      .label('GatewayPublicRegister'),
    specialLegalPowers: answerWithDetails(
      'agree',
      'GatewaySpecialLegalPowers'
    ).required(),
    harbourAuthority: answerWithDetails(
      'area',
      'GatewayHarbourAuthority'
    ).required(),
    otherAuthorities: answerWithDetails(
      'agree',
      'GatewayOtherAuthorities'
    ).required(),
    publicConsultation: answerWithDetails(
      'consulted',
      'GatewayPublicConsultation'
    ).required(),
    waterFrameworkDirective: gatewayWaterFrameworkDirectiveSchema.required(),
    sites: joi.array().items(gatewaySiteSchema).required(),
    marinePlanPolicies: joi
      .array()
      .items(gatewayMarinePlanPolicySchema)
      .required(),
    withdrawnAt: joi.date().iso().allow(null).required()
  })
  .label('MarineLicenceGatewayResponse')

export const wfdDocumentDownloadUrlResponseSchema = joi
  .object({
    message: joi.string().valid('success').required(),
    value: joi
      .object({
        url: joi.string().uri().required(),
        expiresIn: joi.number().integer().required()
      })
      .required()
  })
  .label('WfdDocumentDownloadUrlResponse')
