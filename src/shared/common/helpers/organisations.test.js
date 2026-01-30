import { describe, it, expect } from 'vitest'
import { isOrganisationEmployee } from './organisations.js'

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
