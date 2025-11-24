import Boom from '@hapi/boom'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'

export const errorIfSubmittedExemptionNotPublic = (exemption) => {
  if (
    exemption.status !== EXEMPTION_STATUS.ACTIVE ||
    exemption.publicRegister?.consent === 'no'
  ) {
    throw Boom.forbidden('Not authorized to request this resource')
  }
}
