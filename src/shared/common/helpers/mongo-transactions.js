/**
 * Runs `fn` inside a multi-document transaction and returns its result.
 *
 * The callback receives the session and must pass it to every operation
 * that belongs to the transaction (e.g. `collection.insertOne(doc, { session })`).
 * On a thrown error the transaction is aborted, no write persists, and the
 * error is rethrown. The session is always ended.
 *
 * Transactions require primary reads - see the readPreference default in
 * config.js, which deliberately overrides URI-supplied read preferences.
 *
 * @param {import('mongodb').MongoClient} mongoClient - e.g. `server.mongoClient`
 * @param {(session: import('mongodb').ClientSession) => Promise<unknown>} fn
 */
export const withMongoTransaction = async (mongoClient, fn) => {
  const session = mongoClient.startSession()
  try {
    return await session.withTransaction(fn)
  } finally {
    await session.endSession()
  }
}
