import { createIatAnswersController } from './controllers/create-iat-answers.js'
import { getIatAnswersController } from './controllers/get-iat-answers.js'
import { patchIatAnswersController } from './controllers/patch-iat-answers.js'
import { publishIatAnswersController } from './controllers/publish-iat-answers.js'

export const iatAnswers = [
  { method: 'POST', path: '/iat-answers', ...createIatAnswersController },
  {
    method: 'PATCH',
    path: '/iat-answers/{slug}',
    ...patchIatAnswersController
  },
  {
    method: 'POST',
    path: '/iat-answers/{slug}/publish',
    ...publishIatAnswersController
  },
  { method: 'GET', path: '/iat-answers/{slug}', ...getIatAnswersController }
]
