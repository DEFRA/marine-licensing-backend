import { publicRegisterNationalSecurity } from '../../models/public-register-national-security.js'
import { createUpdatePublicRegisterAnswersController } from './update-public-register-answers.js'

export const updatePublicRegisterNationalSecurityController =
  createUpdatePublicRegisterAnswersController({
    schema: publicRegisterNationalSecurity,
    errorContext: 'public register national security'
  })
