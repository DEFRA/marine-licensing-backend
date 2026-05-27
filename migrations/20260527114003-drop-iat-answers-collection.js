// The iat-answers collection was replaced by iat-contexts +
// iat-outcome-documents in ML-1306.

export const up = async (db) => {
  await db.collection('iat-answers').drop()
}

export const down = async () => {}
