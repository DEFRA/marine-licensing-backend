export const isOrganisationEmployee = (organisation) => {
  return organisation?.userRelationshipType === 'Employee'
}

export const isConsulteeOrganisation = (currentOrganisation, project) => {
  const organisationId = currentOrganisation?.organisationId
  return (
    Boolean(organisationId) &&
    (project?.consultationRequests ?? []).some(({ consultees }) =>
      consultees?.some(
        (consultee) => consultee.organisationId === organisationId
      )
    )
  )
}
