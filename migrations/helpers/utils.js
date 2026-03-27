/**
 * Drop an index, ignoring the error if it doesn't exist.
 *
 * @param {import('mongodb').Db} db
 * @param {string} collectionName
 * @param {string} indexName
 */
export async function safeDropIndex(db, collectionName, indexName) {
  try {
    await db.collection(collectionName).dropIndex(indexName)
  } catch (error) {
    if (error.codeName !== 'IndexNotFound') { throw error }
  }
}
