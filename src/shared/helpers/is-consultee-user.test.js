import { getConsulteeOrganisationIdFromAuthToken } from './is-consultee-user.js'

describe('getConsulteeOrganisationIdFromAuthToken', () => {
  const createAuth = (relationship) => ({
    artifacts: {
      decoded: {
        currentRelationshipId: 'rel-id',
        relationships: [relationship]
      }
    }
  })

  it('should return the organisation ID for a Consultee relationship', () => {
    expect(
      getConsulteeOrganisationIdFromAuthToken(
        createAuth('rel-id:org-123:Consultee Org:0:Consultee:0')
      )
    ).toBe('org-123')
  })

  it.each([
    ['an Employee relationship', createAuth('rel-id:org-123:Org:0:Employee:0')],
    [
      'a Consultee with no organisation ID',
      createAuth('rel-id::Org:0:Consultee:0')
    ],
    ['no relationships', { artifacts: { decoded: {} } }]
  ])('should throw forbidden for %s', (_, auth) => {
    expect(() => getConsulteeOrganisationIdFromAuthToken(auth)).toThrow(
      'Not authorised to view consultations: user is not signed in as a consultee organisation'
    )
  })
})
