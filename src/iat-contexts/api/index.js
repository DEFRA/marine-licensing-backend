import { createIatContextController } from './controllers/create-iat-context.js'
import { patchIatContextController } from './controllers/patch-iat-context.js'
import { getIatContextController } from './controllers/get-iat-context.js'
import { mintOutcomeDocumentController } from './controllers/mint-outcome-document.js'

export const iatContexts = [
  { method: 'POST', path: '/iat-contexts', ...createIatContextController },
  {
    method: 'PATCH',
    path: '/iat-contexts/{slug}',
    ...patchIatContextController
  },
  { method: 'GET', path: '/iat-contexts/{slug}', ...getIatContextController },
  {
    method: 'POST',
    path: '/iat-contexts/{slug}/outcome-documents',
    ...mintOutcomeDocumentController
  }
]
