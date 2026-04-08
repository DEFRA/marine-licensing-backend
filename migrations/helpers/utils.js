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
    // Avoid throwing if the index or the collection does not exist
    if (
      error.codeName !== 'IndexNotFound' &&
      error.codeName !== 'NamespaceNotFound'
    ) {
      throw error
    }
  }
}
