import { publicRegisterNationalSecurity } from '../../models/public-register-national-security.js'
import { createUpdatePublicRegisterController } from '../helpers/create-update-public-register-controller.js'

export const updatePublicRegisterNationalSecurityController =
  createUpdatePublicRegisterController({
    schema: publicRegisterNationalSecurity,
    errorContext: 'public register national security'
  })
