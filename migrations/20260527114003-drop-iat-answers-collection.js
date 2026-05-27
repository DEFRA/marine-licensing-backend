// The iat-answers collection was replaced by iat-contexts +
// iat-outcome-documents in ML-1306. The collection exists on
// dev/test/perf-test (created by 20260515164832-iat-answers-slug-index.js)
// but not yet on prod. drop() returns false on NamespaceNotFound rather
// than throwing (mongodb driver: lib/operations/drop.js handleError),
// so this is safely a no-op where the collection is absent.

export const up = async (db) => {
  await db.collection('iat-answers').drop()
}

export const down = async () => {
  // Forward-only: we cannot recreate the dropped data.
}
