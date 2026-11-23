export const unlinkMarinePlanPolicyDocuments = (
  documents = [],
  policyCodes
) => {
  const codesToUnlink = new Set(policyCodes)

  const nextDocuments = []
  const orphanedDocuments = []

  let changed = false

  for (const document of documents) {
    const links = document.policyLinks ?? []

    const remaining = links.filter(
      ({ policyCode }) => !codesToUnlink.has(policyCode)
    )

    if (remaining.length === links.length) {
      nextDocuments.push(document)
      continue
    }

    changed = true

    if (remaining.length === 0) {
      orphanedDocuments.push(document)
    } else {
      nextDocuments.push({ ...document, policyLinks: remaining })
    }
  }

  return { documents: nextDocuments, orphanedDocuments, changed }
}
