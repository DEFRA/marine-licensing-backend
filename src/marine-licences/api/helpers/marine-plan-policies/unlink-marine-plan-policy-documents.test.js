import { unlinkMarinePlanPolicyDocuments } from './unlink-marine-plan-policy-documents.js'

const link = (policyCode) => ({ policyCode, location: 'Section 1' })
const document = (documentId, policyLinks) => ({ documentId, policyLinks })

describe('unlinkMarinePlanPolicyDocuments', () => {
  test('removes the links, orphans documents left with none and leaves the rest alone', () => {
    const shared = document('shared', [
      link('E-AGG-3'),
      link('E-MPA-1'),
      link('E-BIO-1')
    ])
    const orphan = document('orphan', [link('E-AGG-3'), link('E-MPA-1')])
    const untouched = document('untouched', [link('E-BIO-2')])
    const inProgress = document('in-progress', [])
    const noLinksField = { documentId: 'no-links-field' }

    expect(
      unlinkMarinePlanPolicyDocuments(
        [shared, orphan, untouched, inProgress, noLinksField],
        ['E-AGG-3', 'E-MPA-1']
      )
    ).toEqual({
      documents: [
        { ...shared, policyLinks: [link('E-BIO-1')] },
        untouched,
        inProgress,
        noLinksField
      ],
      orphanedDocuments: [orphan],
      changed: true
    })
  })

  test.each([[undefined], [[document('doc', [link('E-BIO-2')])]]])(
    'reports no change when nothing links to the policies: %j',
    (documents) => {
      expect(unlinkMarinePlanPolicyDocuments(documents, ['E-AGG-3'])).toEqual({
        documents: documents ?? [],
        orphanedDocuments: [],
        changed: false
      })
    }
  )
})
