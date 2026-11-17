import { publicRegisterCommercialConfidentiality } from '../../models/public-register-commercial-confidentiality.js'
import { createUpdatePublicRegisterController } from '../helpers/create-update-public-register-controller.js'

export const updatePublicRegisterCommercialConfidentialityController =
  createUpdatePublicRegisterController({
    schema: publicRegisterCommercialConfidentiality,
    errorContext: 'public register commercial confidentiality'
  })
