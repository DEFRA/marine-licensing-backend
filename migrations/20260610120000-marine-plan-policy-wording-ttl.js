const twentyFourHoursInSeconds = 86400

export const up = async (db) => {
  const col = db.collection('marine-plan-policy-wording')
  await col.createIndex(
    { fetchedAt: 1 },
    { expireAfterSeconds: twentyFourHoursInSeconds }
  )
}

export const down = async (db) => {
  await db.collection('marine-plan-policy-wording').drop()
}
