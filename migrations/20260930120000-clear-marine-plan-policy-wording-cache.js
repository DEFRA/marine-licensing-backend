// Rows cached before title/category were added would otherwise be pinned into
// write-once snapshots without them until the 24h TTL expires them.
export const up = async (db) => {
  await db.collection('marine-plan-policy-wording').deleteMany({})
}

export const down = async () => {}
