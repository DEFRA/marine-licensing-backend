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
keeps its response, `requiresDocumentation` and document links unchanged.

After the worker stores the new policies, links to policies no longer in the set
are removed, using
`src/marine-licences/api/helpers/marine-plan-policies/remove-orphaned-marine-plan-policy-documents.js`.
Documents left with no links are removed and their S3 files deleted, unless another
licence still references them. Documents still linked to a current policy, and
uploads not yet linked, are kept. Responses are not changed. The write is
conditioned on `marinePlanPolicyJobId` and on the documents being unchanged since
they were read, so neither a site edit since the job started nor a concurrent
upload or link save is overwritten; the stale links are then left in place.

Each cleanup that changes the licence logs one `info` line with event action
`mp-policies:documents-unlinked`, naming the removed policy codes and the deleted
`documentId`s. The cleanup is best-effort: a failure is logged as an `error` and
never fails or retries the policy job, which is already `READY`.

## When the applicant unticks supporting documents

Saving a response with `requiresDocumentation: false` removes that policy's links
in the same write, using the helper
`src/marine-licences/api/helpers/marine-plan-policies/unlink-marine-plan-policy-documents.js`.
Documents still linked to another policy are kept.

If a document would be left with no links, nothing is written unless the payload
has `confirmDocumentDeletion: true`. Without it, the response is
`value: { confirmationRequired: true, orphanedDocuments: [{ documentId, filename }] }`
for the frontend's confirmation page. With it, the orphaned documents are removed
and their S3 files deleted, unless another licence still references them.

## Derived on read

`GET /marine-licence/{id}` returns `marinePlanPolicySupportingDocuments`, built in
`src/marine-licences/api/helpers/marine-plan-policies/marine-plan-policy-documents-required.js`:

| Field                  | Meaning                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `linkedDocuments`      | Stored documents with at least one policy link. Only the links step writes links, so these are documents whose journey is complete.                                       |
| `unlinkedDocuments`    | Stored documents with no policy links yet: uploads still in progress, or abandoned before the links step.                                                                 |
| `requiringDocuments`   | Current policies with `requiresDocumentation: true`, in `marinePlanPolicies` order. The checkbox page lists these, including policies already linked to another document. |
| `documentsOutstanding` | Policies requiring documents not yet covered by any document.                                                                                                             |
| `status`               | `NOT_REQUIRED` when no policy requires documents, `INCOMPLETE` when `documentsOutstanding` is not empty, otherwise `COMPLETED`.                                           |

A link covers its policy only when its `location` is not blank. Links already
stored for policies that are no longer current or no longer require documents are
ignored. Saving links is rejected with a 400 when the document has no
`documentType` yet or any `policyCode` is not in `requiringDocuments`.

`requiringDocuments`, `documentsOutstanding` and `status` come from one calculation, so the policy page,
the review page and the status cannot disagree.

## Task list and submit

On submit, every document in `unlinkedDocuments` is removed from the licence and
its S3 file is deleted, unless another licence still references the file (a copy
of a rejected licence shares its documents' files).

The marine plan policies task is `COMPLETED` only when every policy is answered
and the supporting documents `status` is not `INCOMPLETE`; with every answer in
but documents outstanding it stays `IN_PROGRESS`. `NOT_REQUIRED` counts as
satisfied, because submit rejects any task that is not `COMPLETED`. The GET
response and submit both build the status with
`buildMarinePlanPolicySupportingDocuments`, so the task list and submit cannot
disagree.
