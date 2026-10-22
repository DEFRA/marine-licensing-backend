import { describe, it, expect } from 'vitest'
import {
  isOrganisationColleague,
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

describe('isOrganisationColleague', () => {
  const organisationId = '27d48d6c-6e94-f011-b4cc-000d3ac28f39'
  const employee = { organisationId, userRelationshipType: 'Employee' }
  const project = { organisation: { id: organisationId } }

  it.each(['Employee', 'Agent', 'Citizen'])(
    'should return true for any member of the project organisation (%s)',
    (userRelationshipType) => {
      expect(
        isOrganisationColleague(
          { organisationId, userRelationshipType },
          project
        )
      ).toBe(true)
    }
  )

  it.each([
    [
      'a member of a different organisation',
      { ...employee, organisationId: 'another-org-id' },
      project
    ],
    ['no current organisation', undefined, project],
    ['a project with no organisation', employee, {}],
    ['no project', employee, undefined],
    [
      'null organisation ids on both sides',
      { ...employee, organisationId: null },
      { organisation: { id: null } }
    ]
  ])('should return false for %s', (_, currentOrganisation, proj) => {
    expect(isOrganisationColleague(currentOrganisation, proj)).toBe(false)
  })
})
