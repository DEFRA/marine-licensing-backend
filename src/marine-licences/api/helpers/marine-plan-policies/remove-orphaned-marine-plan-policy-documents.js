import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import { structureErrorForECS } from '../../../../shared/common/helpers/logging/logger.js'
import { MARINE_PLAN_POLICY_EVENT_ACTION } from '../../../constants/marine-licence.js'
import {
  collectS3Locations,
  deleteOrphanedS3Objects
} from '../deleteS3Objects.js'
import { unlinkMarinePlanPolicyDocuments } from './unlink-marine-plan-policy-documents.js'

const removeOrphanedDocuments = async ({
  db,
  _id,
  policyJobId,
  marinePlanPolicies,
  logger
}) => {
  const collection = db.collection(collectionMarineLicences)
  const licence = await collection.findOne(
    { _id },
    { projection: { marinePlanPolicyDocuments: 1 } }
  )

  const currentCodes = new Set(
    marinePlanPolicies.map(({ policyCode }) => policyCode)
  )
  const removedCodes = new Set(
    (licence?.marinePlanPolicyDocuments ?? [])
      .flatMap(({ policyLinks = [] }) =>
        policyLinks.map(({ policyCode }) => policyCode)
      )
      .filter((code) => !currentCodes.has(code))
  )

  const { documents, orphanedDocuments, changed } =
    unlinkMarinePlanPolicyDocuments(
      removedCodes,
      licence?.marinePlanPolicyDocuments
    )
  if (!changed) {
    return
  }

  const result = await collection.updateOne(
    {
      _id,
      marinePlanPolicyJobId: policyJobId,
      marinePlanPolicyDocuments: licence.marinePlanPolicyDocuments
    },
    { $set: { marinePlanPolicyDocuments: documents } }
  )

  if (result.matchedCount === 0) {
    return
  }

  const licenceId = _id.toHexString()
  const orphanedIds = orphanedDocuments.map(({ documentId }) => documentId)
  logger.info(
    {
      event: {
        action: MARINE_PLAN_POLICY_EVENT_ACTION.DOCUMENTS_UNLINKED,
        outcome: 'success',
        reference: licenceId
      }
    },
    `Removed supporting document links to policies no longer applicable on licence ${licenceId} (${[...removedCodes].join(', ')}); deleted ${orphanedIds.length} document(s) left with no links: [${orphanedIds.join(', ')}]`
  )
  await deleteOrphanedS3Objects(db, collectS3Locations(orphanedDocuments))
}

// Best-effort: the policies are already stored, so a failure here is logged
// and must never fail or retry the policy job.
export const removeOrphanedMarinePlanPolicyDocuments = async (options) => {
  try {
    await removeOrphanedDocuments(options)
  } catch (error) {
    options.logger.error(
      structureErrorForECS(error),
      `Failed to remove supporting documents orphaned by the policy re-query on licence ${options._id.toHexString()}`
    )
  }
}
