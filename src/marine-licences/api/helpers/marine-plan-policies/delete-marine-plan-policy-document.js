import { collectionMarineLicences } from '../../../../shared/common/constants/db-collections.js'
import {
  collectS3Locations,
  deleteOrphanedS3Objects
} from '../deleteS3Objects.js'

export const deleteMarinePlanPolicyDocument = async ({
  db,
  _id,
  document,
  auditFields
}) => {
  await db.collection(collectionMarineLicences).updateOne(
    { _id },
    {
      $pull: { marinePlanPolicyDocuments: { documentId: document.documentId } },
      ...(auditFields && { $set: auditFields })
    }
  )

  await deleteOrphanedS3Objects(db, collectS3Locations(document))
}
