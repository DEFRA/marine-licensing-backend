import { publicRegisterCommercialConfidentiality } from '../../models/public-register-commercial-confidentiality.js'
import { createUpdatePublicRegisterAnswersController } from './update-public-register-answers.js'

export const updatePublicRegisterCommercialConfidentialityController =
  createUpdatePublicRegisterAnswersController({
    schema: publicRegisterCommercialConfidentiality,
    errorContext: 'public register commercial confidentiality'
  })
