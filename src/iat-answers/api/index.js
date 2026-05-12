import { createIatAnswersController } from './controllers/create-iat-answers.js'
import { updateIatAnswersController } from './controllers/update-iat-answers.js'
import { deleteIatAnswersController } from './controllers/delete-iat-answers.js'
import { getIatAnswersController } from './controllers/get-iat-answers.js'

export const iatAnswers = [
  {
    method: 'POST',
    path: '/iat-answers',
    ...createIatAnswersController
  },
  {
    method: 'PUT',
    path: '/iat-answers/{id}',
    ...updateIatAnswersController
  },
  {
    method: 'DELETE',
    path: '/iat-answers/{id}',
    ...deleteIatAnswersController
  },
  {
    method: 'GET',
    path: '/iat-answers/{id}',
    ...getIatAnswersController
  }
]
