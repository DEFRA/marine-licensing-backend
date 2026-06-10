import { getOutcomeDocumentController } from './controllers/get-outcome-document.js'

export const iatOutcomeDocuments = [
  {
    method: 'GET',
    path: '/outcome-documents/{slug}',
    ...getOutcomeDocumentController
  }
]
