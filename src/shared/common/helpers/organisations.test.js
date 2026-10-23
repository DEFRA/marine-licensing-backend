import { describe, it, expect } from 'vitest'
import {
  isConsulteeOrganisation,
  isOrganisationEmployee
} from './organisations.js'

describe('isOrganisationEmployee', () => {
  it('should return true when userRelationshipType is Employee', () => {
    const organisation = { userRelationshipType: 'Employee' }
    expect(isOrganisationEmployee(organisation)).toBe(true)
  })

  it('should return false when userRelationshipType is Agent', () => {
    const organisation = { userRelationshipType: 'Agent' }
    expect(isOrganisationEmployee(organisation)).toBe(false)
  })

  it('should return false when userRelationshipType is something else', () => {
    const organisation = { userRelationshipType: 'Other' }
    expect(isOrganisationEmployee(organisation)).toBe(false)
  })

  it('should return false when organisation is undefined', () => {
    expect(isOrganisationEmployee(undefined)).toBe(false)
  })

  it('should return false when organisation is null', () => {
    expect(isOrganisationEmployee(null)).toBe(false)
  })

  it('should return false when userRelationshipType is undefined', () => {
    const organisation = {}
    expect(isOrganisationEmployee(organisation)).toBe(false)
  })
})

describe('isConsulteeOrganisation', () => {
  const organisationId = '27d48d6c-6e94-f011-b4cc-000d3ac28f39'
  const consultee = { organisationId, userRelationshipType: 'Citizen' }
  const consulteesOf = (...ids) => ({
    consultees: ids.map((id) => ({ organisationId: id }))
  })
  const project = {
    organisation: { id: 'applicant-org-id' },
    consultationRequests: [
      consulteesOf('other-org-id'),
      consulteesOf('other-org-id', organisationId)
    ]
  }

  it('should return true when the organisation is a consultee on any consultation request', () => {
    expect(isConsulteeOrganisation(consultee, project)).toBe(true)
  })

  it.each([
    [
      'an organisation not among the consultees',
      { ...consultee, organisationId: 'another-org-id' },
      project
    ],
    [
      'a member of the applicant organisation',
      { ...consultee, organisationId: 'applicant-org-id' },
      project
    ],
    ['no current organisation', undefined, project],
    ['a project with no consultation requests', consultee, {}],
    [
      'a consultation request with no consultees',
      consultee,
      { consultationRequests: [{}] }
    ],
    ['no project', consultee, undefined],
    [
      'null organisation ids on both sides',
      { ...consultee, organisationId: null },
      { consultationRequests: [consulteesOf(null)] }
    ]
  ])('should return false for %s', (_, currentOrganisation, proj) => {
    expect(isConsulteeOrganisation(currentOrganisation, proj)).toBe(false)
  })
})
