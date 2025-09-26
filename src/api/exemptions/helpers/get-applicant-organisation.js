export const getApplicantOrganisationId = (auth) => {
  const [_relationshipId, applicantOrganisationId] =
    auth?.artifacts?.decoded?.relationships?.[0]?.split(':') || []
  return applicantOrganisationId || null
}
