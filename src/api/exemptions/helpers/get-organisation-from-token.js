export const getOrganisationIdFromAuthToken = (auth) => {
  // currentRelationshipId is the relationship the user is signing into the service in the context of, based on what they selected in the organisation picker (either themselves, or a linked org)
  // relationships - The relationships the user has selected to sign into the service in, within their current session.
  const { currentRelationshipId, relationships } =
    auth?.artifacts?.decoded || {}
  if (!currentRelationshipId || !Array.isArray(relationships)) {
    return null
  }
  const relationship = relationships.find((r) =>
    r.startsWith(currentRelationshipId)
  )
  // destructure the relationships array eg
  // 81d48d6c-6e94-f011-b4cc-000d3ac28f39:27d48d6c-6e94-f011-b4cc-000d3ac28f39:CDP Child Org 1:0:Employee:0
  // which is colon-separated with the following parts:
  // relationshipId:organisationId:organisationName:organisationLoa:relationshipType:relationshipLoa.
  const [, organisationId] = relationship?.split(':') || []
  return organisationId || null
}
