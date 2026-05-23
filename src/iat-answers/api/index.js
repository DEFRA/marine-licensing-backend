import { createIatAnswersController } from './controllers/create-iat-answers.js'
import { getIatAnswersController } from './controllers/get-iat-answers.js'
import { patchIatAnswersController } from './controllers/patch-iat-answers.js'

export const iatAnswers = [
  {
    method: 'POST',
    path: '/iat-answers',
    ...createIatAnswersController
  },
  {
    method: 'PATCH',
    path: '/iat-answers/{slug}',
    ...patchIatAnswersController
  },
  {
    method: 'GET',
    path: '/iat-answers/{slug}',
    ...getIatAnswersController
  }
]
