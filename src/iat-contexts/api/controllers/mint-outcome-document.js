import Boom from '@hapi/boom'
import { StatusCodes } from 'http-status-codes'
import {
  iatContextSlugParams,
  outcomeDocumentMintBody
} from '../../models/iat-context.js'
import { addCreateAuditFieldsOptional } from '../../../shared/common/helpers/mongo-audit.js'
import {
  collectionIatContexts,
  collectionIatOutcomeDocuments
} from '../../../shared/common/constants/db-collections.js'
import { MONGO_DUPLICATE_KEY_CODE } from '../../../shared/common/constants/mongo.js'
import { structureErrorForECS } from '../../../shared/common/helpers/logging/logger.js'
import { generateSlug } from '../../../iat-shared/helpers/generate-slug.js'
import { config } from '../../../config.js'

export const mintOutcomeDocumentController = {
  options: {
    auth: { mode: 'optional' },
    validate: {
      params: iatContextSlugParams,
      payload: outcomeDocumentMintBody
    }
  },
  handler: async (request, h) => {
    try {
      const { params, payload, db, auth } = request
      const contexts = db.collection(collectionIatContexts)
      const outcomeDocs = db.collection(collectionIatOutcomeDocuments)

      const context = await contexts.findOne({ slug: params.slug })
      if (!context) {
        throw Boom.notFound('IAT context not found or expired')
      }

      const snapshot = await insertSnapshot(outcomeDocs, auth, context, payload)

      return h
        .response({
          message: 'success',
          value: {
            slug: snapshot.slug,
            viewUrl: `/journey/self-service/outcome-document/${snapshot.slug}`,
            answersUrl: `${config.get('frontEndBaseUrl')}/journey/self-service/outcome-document/${snapshot.slug}`,
            snapshot
          }
        })
        .code(StatusCodes.CREATED)
    } catch (error) {
      if (error.isBoom) {
        throw error
      }
      request.logger.error(
        structureErrorForECS(error),
        'Error minting outcome document'
      )
      throw Boom.internal(`Error minting outcome document: ${error.message}`)
    }
  }
}

async function insertSnapshot(collection, auth, context, payload) {
  const base = {
    contextSlug: context.slug,
    questionLog: context.questionLog ?? [],
    preamble: payload.preamble,
    outcomeRoute: payload.outcomeRoute,
    outcomeKind: payload.outcomeKind,
    outcomeHeading: payload.outcomeHeading,
    outcomeText: payload.outcomeText,
    focusedOption: payload.focusedOption,
    capturedAt: new Date()
  }
  try {
    const slug = generateSlug()
    const doc = addCreateAuditFieldsOptional(auth, { ...base, slug })
    await collection.insertOne(doc)
    const { _id, ...safeDoc } = doc
    return safeDoc
  } catch (error) {
    if (error.code === MONGO_DUPLICATE_KEY_CODE) {
      const retrySlug = generateSlug()
      const doc = addCreateAuditFieldsOptional(auth, {
        ...base,
        slug: retrySlug
      })
      await collection.insertOne(doc)
      const { _id, ...safeDoc } = doc
      return safeDoc
    }
    throw error
  }
}
