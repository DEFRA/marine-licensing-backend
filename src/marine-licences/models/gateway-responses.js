import joi from 'joi'
import { PROJECT_NAME_MAX_LENGTH } from '../../shared/models/project-name.js'
import { SITE_NAME_MAX_LENGTH } from '../../shared/models/site-details/site-name.js'
import { ACTIVITY_DESCRIPTION_MAX_LENGTH } from './activity-details/activity-description.js'
import { MONTHS_OF_ACTIVITY_DETAILS_MAX_LENGTH } from './activity-details/activity-months.js'
import { OTHER_ACTIVITY_MAX_LENGTH } from './activity-details/activity-type.js'
import { COMPLETION_DATE_REASON_MAX_LENGTH } from './activity-details/completion-date.js'
import { WORKING_HOURS_MAX_LENGTH } from './activity-details/working-hours.js'
import { HARBOUR_AUTHORITY_DETAILS_MAX_TEXT_LENGTH } from './harbour-authority.js'
import {
  POLICY_CODE_MAX_LENGTH,
  POLICY_RESPONSE_MAX_LENGTH
} from './marine-plan-policy.js'
import { OTHER_AUTHORITIES_DETAILS_MAX_TEXT_LENGTH } from './other-authorities.js'
import { PROJECT_BACKGROUND_MAX_TEXT_LENGTH } from './project-background.js'
import { PUBLIC_CONSULTATION_DETAILS_MAX_TEXT_LENGTH } from './public-consultation.js'
import { PUBLIC_REGISTER_REASON_MAX_TEXT_LENGTH } from './public-register.js'
import { SPECIAL_LEGAL_POWERS_DETAILS_MAX_TEXT_LENGTH } from './special-legal-powers.js'

export const nullableString = joi.string().allow('', null)

const yesNoAnswer = joi
  .string()
  .valid('yes', 'no')
  .allow(null)
  .label('YesNoAnswer')

const limitedText = (maxLength) => nullableString.max(maxLength)

const answerWithDetails = (answerKey, detailsMaxLength, label) =>
  joi
    .object({
      [answerKey]: yesNoAnswer,
      details: limitedText(detailsMaxLength)
    })
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
    otherActivity: limitedText(OTHER_ACTIVITY_MAX_LENGTH).required(),
    activityDescription: limitedText(
      ACTIVITY_DESCRIPTION_MAX_LENGTH
    ).required(),
    activityDuration: nullableString.required(),
    activityMonths: joi
      .object({
        applicable: nullableString,
        details: limitedText(MONTHS_OF_ACTIVITY_DETAILS_MAX_LENGTH)
      })
      .required()
      .label('ActivityMonths'),
    completionDate: joi
      .object({
        hasSpecificDate: nullableString,
        reason: limitedText(COMPLETION_DATE_REASON_MAX_LENGTH)
      })
      .required()
      .label('CompletionDate'),
    workingHours: limitedText(WORKING_HOURS_MAX_LENGTH).required()
  })
  .label('Activity')

const gatewaySiteSchema = joi
  .object({
    siteIndex: joi.number().integer().required(),
    siteName: limitedText(SITE_NAME_MAX_LENGTH).required(),
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
    policyCode: limitedText(POLICY_CODE_MAX_LENGTH).required(),
    policyInformation: nullableString.required(),
    applicantAnswer: limitedText(POLICY_RESPONSE_MAX_LENGTH).required()
  })
  .label('MarinePlanPolicy')

const gatewayWaterFrameworkDirectiveSchema = joi
  .object({
    nauticalMile: yesNoAnswer.required(),
    excludedActivities: yesNoAnswer.required(),
    documentUrl: joi.string().uri().allow(null).required(),
    fileName: nullableString.required()
  })
  .label('WaterFrameworkDirective')

export const marineLicenceGatewayResponseSchema = joi
  .object({
    projectName: limitedText(PROJECT_NAME_MAX_LENGTH).required(),
    projectBackground: limitedText(
      PROJECT_BACKGROUND_MAX_TEXT_LENGTH
    ).required(),
    preferredLicenceDates: nullableString.required(),
    publicRegister: joi
      .object({
        withholdConsent: yesNoAnswer,
        reason: limitedText(PUBLIC_REGISTER_REASON_MAX_TEXT_LENGTH)
      })
      .unknown(true)
      .allow(null)
      .required()
      .label('PublicRegister'),
    specialLegalPowers: answerWithDetails(
      'agree',
      SPECIAL_LEGAL_POWERS_DETAILS_MAX_TEXT_LENGTH,
      'SpecialLegalPowers'
    ).required(),
    harbourAuthority: answerWithDetails(
      'area',
      HARBOUR_AUTHORITY_DETAILS_MAX_TEXT_LENGTH,
      'HarbourAuthority'
    ).required(),
    otherAuthorities: answerWithDetails(
      'agree',
      OTHER_AUTHORITIES_DETAILS_MAX_TEXT_LENGTH,
      'OtherAuthorities'
    ).required(),
    publicConsultation: answerWithDetails(
      'consulted',
      PUBLIC_CONSULTATION_DETAILS_MAX_TEXT_LENGTH,
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
