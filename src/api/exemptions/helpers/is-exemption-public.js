import Boom from '@hapi/boom'

export const isExemptionPublic = (exemption) => {
  if (exemption.publicRegister?.consent === 'no') {
    throw Boom.forbidden('Not authorized to request this resource')
  }
}
