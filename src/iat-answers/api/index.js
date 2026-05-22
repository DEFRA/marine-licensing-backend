import { createIatAnswersController } from './controllers/create-iat-answers.js'
import { getIatAnswersController } from './controllers/get-iat-answers.js'

export const iatAnswers = [
  {
    method: 'POST',
    path: '/iat-answers',
    ...createIatAnswersController
  },
  {
    method: 'GET',
    path: '/iat-answers/{slug}',
    ...getIatAnswersController
  }
]
