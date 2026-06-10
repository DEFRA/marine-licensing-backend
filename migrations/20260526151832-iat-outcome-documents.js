export const up = async (db) => {
  const col = db.collection('iat-outcome-documents')
  await col.createIndex({ slug: 1 }, { unique: true })
  await col.createIndex({ contextSlug: 1 })
}

export const down = async (db) => {
  await db.collection('iat-outcome-documents').drop()
}
