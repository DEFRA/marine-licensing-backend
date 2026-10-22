export const isOrganisationEmployee = (organisation) => {
  return organisation?.userRelationshipType === 'Employee'
}

export const isOrganisationColleague = (currentOrganisation, project) => {
  return (
    Boolean(currentOrganisation?.organisationId) &&
    currentOrganisation.organisationId === project?.organisation?.id
  )
}
