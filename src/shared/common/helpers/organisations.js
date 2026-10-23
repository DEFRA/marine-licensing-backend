export const isOrganisationEmployee = (organisation) => {
  return organisation?.userRelationshipType === 'Employee'
}
