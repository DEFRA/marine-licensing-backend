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
    subActivities: joi
      .array()
      .items(joi.string())
      .required()
      .label('SubActivities'),
    otherActivity: nullableString.required(),
    activityDescription: nullableString.required(),
    activityDuration: nullableString.required(),
    activityMonths: joi
      .object({ applicable: nullableString, details: nullableString })
      .required()
      .label('ActivityMonths'),
    completionDate: joi
      .object({ hasSpecificDate: nullableString, reason: nullableString })
      .required()
      .label('CompletionDate'),
    workingHours: nullableString.required()
  })
  .label('Activity')

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
      .label('UploadedFile'),
    circleWidthMetres: joi.number().allow(null).required(),
    geometry: joi
      .object({
        type: joi
          .string()
          .valid('FeatureCollection')
          .required()
          .label('GeometryType'),
        crs: joi.object().unknown(true).label('GeometryCrs'),
        features: joi
          .array()
          .items(joi.object().unknown(true).label('GeometryFeature'))
          .required()
          .label('GeometryFeatures')
      })
      .allow(null)
      .required()
      .label('SiteGeometry'),
    activities: joi
      .array()
      .items(gatewayActivitySchema)
      .required()
      .label('Activities')
  })
  .label('Site')

const gatewayMarinePlanPolicySchema = joi
  .object({
    policyCode: nullableString.required(),
    policyInformation: nullableString.required(),
    applicantAnswer: nullableString.required()
  })
  .label('MarinePlanPolicy')

const gatewayWaterFrameworkDirectiveSchema = joi
  .object({
    nauticalMile: nullableString.required(),
    excludedActivities: nullableString.required(),
    documentUrl: joi.string().uri().allow(null).required(),
    fileName: nullableString.required()
  })
  .label('WaterFrameworkDirective')

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
      .label('PublicRegister'),
    specialLegalPowers: answerWithDetails(
      'agree',
      'SpecialLegalPowers'
    ).required(),
    harbourAuthority: answerWithDetails('area', 'HarbourAuthority').required(),
    otherAuthorities: answerWithDetails('agree', 'OtherAuthorities').required(),
    publicConsultation: answerWithDetails(
      'consulted',
      'PublicConsultation'
    ).required(),
    waterFrameworkDirective: gatewayWaterFrameworkDirectiveSchema.required(),
    sites: joi.array().items(gatewaySiteSchema).required().label('Sites'),
    marinePlanPolicies: joi
      .array()
      .items(gatewayMarinePlanPolicySchema)
      .required()
      .label('MarinePlanPolicies'),
    withdrawnAt: joi.date().iso().allow(null).required()
  })
  .label('MarineLicence')

export const wfdDocumentDownloadUrlResponseSchema = joi
  .object({
    message: joi.string().valid('success').required().label('SuccessMessage'),
    value: joi
      .object({
        url: joi.string().uri().required(),
        expiresIn: joi.number().integer().required()
      })
      .required()
      .label('WfdDocumentDownloadUrl')
  })
  .label('WfdDocumentDownloadUrlResponse')
