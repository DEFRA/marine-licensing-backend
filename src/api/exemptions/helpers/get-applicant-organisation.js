export const getApplicantOrganisationId = (auth) => {
  // destructure the relationships array eg
  // 81d48d6c-6e94-f011-b4cc-000d3ac28f39:27d48d6c-6e94-f011-b4cc-000d3ac28f39:CDP Child Org 1:0:Employee:0
  // which is colon-separated with the following parts:
  // relationshipId:organisationId:organisationName:organisationLoa:relationship:relationshipLoa.
  const [, applicantOrganisationId] =
    auth?.artifacts?.decoded?.relationships?.[0]?.split(':') || []
  return applicantOrganisationId || null
}
