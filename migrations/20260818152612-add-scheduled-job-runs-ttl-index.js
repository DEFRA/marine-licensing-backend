export const up = async (db) => {
  await db
    .collection('scheduled-job-runs')
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
}

export const down = async (db) => {
  await db.collection('scheduled-job-runs').drop()
}
