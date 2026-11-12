# Marine plan policy supporting documents

For each applicable marine plan policy, the applicant can say they will provide a
supporting document. They then upload documents and link each one to the policies
it covers, providing where in the document the information is. This page records how
that is stored and derived.

## Stored on the marine licence

```
marinePlanPolicyResponses: {
  [policyCode]: { response, requiresDocumentation }
}

marinePlanPolicyDocuments: [
  {
    documentId,
    uploadedFile, s3Location,   // set on upload
    documentType,               // a code from MPP_DOCUMENT_TYPES, set in a later step
    documentTypeOther,          // only when documentType is 'other'
    policyLinks: [{ policyCode, location }]
  }
]
```

The link between a document and a policy lives on the document only. Deleting a
document removes its links with it; there is no per-policy record to keep in step.

Each step of the journey writes one part of a document: upload creates it, the
type step adds `documentType`, and the links step replaces `policyLinks` with the
full selection provided by the user.

## When a re-query changes the policies

Both maps above are keyed by `policyCode`, and the set of applicable policies
changes whenever sites change. A policy that is still applicable after a re-query
keeps its response, `requiresDocumentation` and document links unchanged. When a
re-query removes a policy, its document and links are removed.

## Derived on read

`GET /marine-licence/{id}` returns `marinePlanPolicySupportingDocuments`, built in
`src/marine-licences/api/helpers/marine-plan-policies/marine-plan-policy-documents-required.js`:

| Field                | Meaning                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `documents`          | The stored documents, unchanged.                                                                                                                                          |
| `requiringDocuments` | Current policies with `requiresDocumentation: true`, in `marinePlanPolicies` order. The checkbox page lists these, including policies already linked to another document. |
| `required`           | Policies requiring documents not yet covered by any document.                                                                                                             |
| `status`             | `NOT_REQUIRED` when no policy requires documents, `INCOMPLETE` when `required` is not empty, otherwise `COMPLETED`.                                                       |

A link covers its policy only when its `location` is not blank. Links to policies
that are no longer current or no longer require documents are ignored rather than rejected
when saved, so policy codes are not checked against the licence on write.

`requiringDocuments`, `required` and `status` come from one calculation, so the policy page,
the review page and the status cannot disagree.
