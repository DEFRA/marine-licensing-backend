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

const answerWithDetails = ({
  answerKey,
  detailsKey = 'details',
  detailsMaxLength,
  question,
  label
}) =>
  joi
    .object({
      [answerKey]: yesNoAnswer,
      [detailsKey]: limitedText(detailsMaxLength)
    })
    .unknown(true)
    .allow(null)
    .description(
      `${answerKey} answers "${question}". ${detailsKey} is given only when the answer is yes, otherwise null.`
    )
    .label(label)

const gatewayActivitySchema = joi
  .object({
    activityIndex: joi
      .number()
      .integer()
      .required()
      .description('Zero-based position of the activity within its site.'),
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
    activityDuration: nullableString
      .required()
      .description(
        'How long the activity will take, in years and/or months. Null if not provided.'
      )
      .example('1 year 6 months'),
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
    siteIndex: joi
      .number()
      .integer()
      .required()
      .description('Zero-based position of the site in the licence.'),
    siteName: limitedText(SITE_NAME_MAX_LENGTH).required(),
    locationMethod: nullableString.required(),
    coordinatesEntry: nullableString.required(),
    coordinateSystem: nullableString.required(),
    uploadedFile: joi
      .object({
        filename: joi.string().required(),
        fileType: nullableString,
        presignedFileUrl: nullableString.description(
          'Temporary S3 link to the uploaded file. Expires after 4 hours. Null if one could not be generated.'
        )
      })
      .allow(null)
      .required()
      .label('UploadedFile'),
    circleWidthMetres: joi
      .number()
      .allow(null)
      .required()
      .description(
        'Circle diameter in metres, for sites entered as a single point with a width. Null for other sites.'
      ),
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
      .description(
        'Site boundary as a GeoJSON FeatureCollection in WGS84 (EPSG:4326). A circle site is given as a polygon built from its centre point and width. Null if the geometry cannot be built.'
      )
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
    policyCode: limitedText(POLICY_CODE_MAX_LENGTH)
      .required()
      .description('Marine plan policy code.')
      .example('E-AGG-3'),
    policyInformation: nullableString
      .required()
      .description('The policy wording, as sanitised HTML.'),
    applicantAnswer: limitedText(POLICY_RESPONSE_MAX_LENGTH).required()
  })
  .label('MarinePlanPolicy')

const gatewayWaterFrameworkDirectiveSchema = joi
  .object({
    nauticalMile: yesNoAnswer.required(),
    excludedActivities: yesNoAnswer.required(),
    documentUrl: joi
      .string()
      .uri()
      .allow(null)
      .required()
      .description(
        "Not the document itself: the URL of this API's Water Framework Directive download URL route. Call it to get a short-lived link to the document. Null if no document was uploaded."
      ),
    fileName: nullableString.required()
  })
  .description(
    'nauticalMile answers "Are your proposed works within one nautical mile (1.85km) of the low-water line, or in a tidal river or estuary?". excludedActivities answers "Are your proposed works limited to one of the following excluded activities?" and is null when nauticalMile is no.'
  )
  .label('WaterFrameworkDirective')

export const marineLicenceGatewayResponseSchema = joi
  .object({
    projectName: limitedText(PROJECT_NAME_MAX_LENGTH).required(),
    projectBackground: limitedText(
      PROJECT_BACKGROUND_MAX_TEXT_LENGTH
    ).required(),
    preferredLicenceDates: nullableString
      .required()
      .description(
        'The applicant\'s preferred licence period, as "Month YYYY to Month YYYY". Null if not provided.'
      )
      .example('August 2026 to November 2026'),
    publicRegister: answerWithDetails({
      answerKey: 'withholdConsent',
      detailsKey: 'reason',
      detailsMaxLength: PUBLIC_REGISTER_REASON_MAX_TEXT_LENGTH,
      question:
        'Do you want to request that information is withheld for either of these reasons?',
      label: 'PublicRegister'
    }).required(),
    specialLegalPowers: answerWithDetails({
      answerKey: 'agree',
      detailsMaxLength: SPECIAL_LEGAL_POWERS_DETAILS_MAX_TEXT_LENGTH,
      question:
        'Does your organisation have special legal powers to do any of these proposed works?',
      label: 'SpecialLegalPowers'
    }).required(),
    harbourAuthority: answerWithDetails({
      answerKey: 'area',
      detailsMaxLength: HARBOUR_AUTHORITY_DETAILS_MAX_TEXT_LENGTH,
      question: 'Are your proposed works located in a harbour authority area?',
      label: 'HarbourAuthority'
    }).required(),
    otherAuthorities: answerWithDetails({
      answerKey: 'agree',
      detailsMaxLength: OTHER_AUTHORITIES_DETAILS_MAX_TEXT_LENGTH,
      question:
        'Have you applied to, or got permission from, any other authorities in relation to these proposed works?',
      label: 'OtherAuthorities'
    }).required(),
    publicConsultation: answerWithDetails({
      answerKey: 'consulted',
      detailsMaxLength: PUBLIC_CONSULTATION_DETAILS_MAX_TEXT_LENGTH,
      question:
        'Have you consulted with any public groups or organisations before making this application?',
      label: 'PublicConsultation'
    }).required(),
    waterFrameworkDirective: gatewayWaterFrameworkDirectiveSchema.required(),
    sites: joi.array().items(gatewaySiteSchema).required().label('Sites'),
    marinePlanPolicies: joi
      .array()
      .items(gatewayMarinePlanPolicySchema)
      .required()
      .label('MarinePlanPolicies'),
    withdrawnAt: joi
      .date()
      .iso()
      .allow(null)
      .required()
      .description(
        'When the licence was withdrawn, as an ISO 8601 UTC timestamp. Null if it has not been withdrawn.'
      )
      .example('2026-09-15T10:30:00.000Z')
  })
  .label('MarineLicence')

export const wfdDocumentDownloadUrlResponseSchema = joi
  .object({
    message: joi.string().valid('success').required().label('SuccessMessage'),
    value: joi
      .object({
        url: joi
          .string()
          .uri()
          .required()
          .description(
            'Temporary S3 link to the Water Framework Directive document.'
          ),
        expiresIn: joi
          .number()
          .integer()
          .required()
          .description('How long the link is valid for, in seconds.')
      })
      .required()
      .label('WfdDocumentDownloadUrl')
  })
  .label('WfdDocumentDownloadUrlResponse')
