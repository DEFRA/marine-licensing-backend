export const up = async (db) => {
  const col = db.collection('iat-contexts')
  await col.createIndex({ slug: 1 }, { unique: true })
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
}

export const down = async (db) => {
  await db.collection('iat-contexts').drop()
}
