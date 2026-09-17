import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import { ObjectId } from 'mongodb'
import { collectionMarineLicences } from '../../../shared/common/constants/db-collections.js'
import { isEntraIdUser } from '../../../shared/helpers/is-entra-id-user.js'
import {
  redactText,
  buildFieldPath,
  WITHHOLD_FIELDS
} from '../../models/redact-text.js'
import { validateWfdUpload } from '../helpers/validateWfdUpload.js'
import { validateConstructionDrawingUpload } from '../helpers/validateConstructionDrawingUpload.js'

const setRedaction = (key, { updatedAt, oid, text }) => ({
  $set: {
    [key]: {
      redactedAt: updatedAt,
      redactedBy: oid,
      redactedText: text
    }
  }
})
const removeRedaction = (key) => ({ $unset: { [key]: '' } })
const withholdRedaction = (
  key,
  { updatedAt, oid, withhold, filename, s3Location }
) => ({
  $set: {
    [key]: {
      redactedAt: updatedAt,
      redactedBy: oid,
      withhold: Boolean(withhold),
      ...(s3Location && { redactedDocument: { filename, s3Location } })
    }
  }
})

const WFD_FIELD_KEY = 'waterFrameworkDirective.withholdDocument'
const CONSTRUCTION_FIELD_KEY =
  'siteDetails.constructionDrawings.withholdDocument'

const validateUploads = async (fieldKey, s3Location) => {
  if (fieldKey === WFD_FIELD_KEY) {
    return await validateWfdUpload({ s3Location })
  }

  if (fieldKey === CONSTRUCTION_FIELD_KEY) {
    return await validateConstructionDrawingUpload(s3Location)
  }

  throw Boom.notFound('Invalid upload')
}

export const redactTextController = {
  options: {
    payload: {
      parse: true,
      output: 'data'
    },
    validate: {
      query: false,
      payload: redactText
    }
  },
  handler: async (request, h) => {
    if (!isEntraIdUser(request)) {
      throw Boom.forbidden('Not authorised to redact data')
    }

    try {
      const { payload, db, auth } = request
      const {
        id,
        fieldKey,
        text,
        withhold,
        remove,
        filename,
        s3Location,
        updatedAt
      } = payload
      const { oid } = auth.artifacts.decoded

      const fieldPath = buildFieldPath(fieldKey, payload)
      const key = `redactions.${fieldPath}`

      let update

      if (s3Location) {
        await validateUploads(fieldKey, s3Location)
      }

      if (remove) {
        update = removeRedaction(key)
      } else if (WITHHOLD_FIELDS.includes(fieldKey)) {
        update = withholdRedaction(key, {
          updatedAt,
          oid,
          withhold,
          filename,
          s3Location
        })
      } else {
        update = setRedaction(key, { updatedAt, oid, text })
      }

      const result = await db
        .collection(collectionMarineLicences)
        .updateOne({ _id: ObjectId.createFromHexString(id) }, update)
      if (result.matchedCount === 0) {
        throw Boom.notFound('Marine licence not found')
      }
      return h
        .response({
          message: 'success'
        })
        .code(StatusCodes.OK)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      throw Boom.internal(`Error redacting data: ${error.message}`)
    }
  }
}
