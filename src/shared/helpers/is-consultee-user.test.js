import { getConsulteeOrganisationIdFromAuthToken } from './is-consultee-user.js'

describe('getConsulteeOrganisationIdFromAuthToken', () => {
  const createAuth = (
    roles,
    relationships = ['rel-id:org-123:Org:0:Employee:0']
  ) => ({
    artifacts: {
      decoded: {
        currentRelationshipId: 'rel-id',
        relationships,
        roles
      }
    }
  })

  it.each(['3', '2'])(
    'should return the organisation ID when the current relationship has a Consultee role with status %s',
    (status) => {
      expect(
        getConsulteeOrganisationIdFromAuthToken(
          createAuth(['other-rel:Reader:3', `rel-id:Consultee:${status}`])
        )
      ).toBe('org-123')
    }
  )

  it.each([
    ['no Consultee role', createAuth(['rel-id:Reader:3'])],
    [
      'a Consultee role on another relationship',
      createAuth(['other-rel:Consultee:3'])
    ],
    [
      'a role name that only starts with Consultee',
      createAuth(['rel-id:ConsulteeAdmin:3'])
    ],
    ['no roles claim', createAuth(undefined)],
    [
      'no organisation ID',
      createAuth(['rel-id:Consultee:3'], ['rel-id::Org:0:Employee:0'])
    ],
    ['no relationships', { artifacts: { decoded: {} } }]
  ])('should throw forbidden for %s', (_, auth) => {
    expect(() => getConsulteeOrganisationIdFromAuthToken(auth)).toThrow(
      'Not authorised to view consultations: user does not have the Consultee role for this organisation'
    )
  })
})
