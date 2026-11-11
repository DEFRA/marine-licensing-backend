import joi from 'joi'
import { marineLicenceId } from './shared-models.js'
import {
  uploadedFileFieldSchema,
  s3LocationFieldSchema
} from '../../shared/models/site-details/file-upload.js'
import {
  MPP_DOCUMENT_TYPES,
  MPP_DOCUMENT_TYPE_OTHER_MAX_LENGTH
} from '../constants/marine-plan-policy-document.js'

export const POLICY_CODE_MAX_LENGTH = 100
export const POLICY_CONSIDERATION_MIN_LENGTH = 70
export const POLICY_CONSIDERATION_MAX_LENGTH = 5000

export const calculateMarinePlanPoliciesSchema = joi
  .object()
  .append(marineLicenceId)

export const marinePlanPolicyResponseSchema = joi
  .object({
    policyCode: joi.string().max(POLICY_CODE_MAX_LENGTH).required().messages({
      'string.empty': 'POLICY_CODE_REQUIRED',
      'string.max': 'POLICY_CODE_INVALID',
      'any.required': 'POLICY_CODE_REQUIRED'
    }),
    response: joi
      .string()
      .allow('')
      .min(POLICY_CONSIDERATION_MIN_LENGTH)
      .max(POLICY_CONSIDERATION_MAX_LENGTH)
      .required()
      .messages({
        'string.min': 'POLICY_CONSIDERATION_MIN_LENGTH',
        'string.max': 'POLICY_CONSIDERATION_MAX_LENGTH',
        'any.required': 'POLICY_RESPONSE_REQUIRED'
      }),
    requiresDocumentation: joi.boolean().default(false).messages({
      'boolean.base': 'REQUIRES_DOCUMENTATION_INVALID'
    })
  })
  .append(marineLicenceId)

export const addMarinePlanPolicyDocumentSchema = joi
  .object({
    uploadedFile: uploadedFileFieldSchema,
    s3Location: s3LocationFieldSchema
  })
  .append(marineLicenceId)

export const marinePlanPolicyDocumentTypeSchema = joi
  .object({
    documentId: joi.string().guid().required().messages({
      'string.guid': 'DOCUMENT_ID_INVALID',
      'any.required': 'DOCUMENT_ID_REQUIRED'
    }),
    documentType: joi
      .string()
      .valid(...MPP_DOCUMENT_TYPES)
      .required()
      .messages({
        'any.only': 'DOCUMENT_TYPE_REQUIRED',
        'any.required': 'DOCUMENT_TYPE_REQUIRED'
      }),
    documentTypeOther: joi.when('documentType', {
      is: joi.string().valid('other'),
      then: joi
        .string()
        .trim()
        .max(MPP_DOCUMENT_TYPE_OTHER_MAX_LENGTH)
        .required()
        .messages({
          'string.empty': 'DOCUMENT_TYPE_OTHER_REQUIRED',
          'any.required': 'DOCUMENT_TYPE_OTHER_REQUIRED',
          'string.max': 'DOCUMENT_TYPE_OTHER_MAX_LENGTH'
        }),
      otherwise: joi.any().strip()
    })
  })
  .append(marineLicenceId)
