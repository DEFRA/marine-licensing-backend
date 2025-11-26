import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'

export class ExemptionService {
  constructor({ db, logger }) {
    this.db = db
    this.logger = logger
  }

  async #findExemptionById(id) {
    const _id = ObjectId.createFromHexString(id)
    const result = await this.db.collection('exemptions').findOne({ _id })

    if (!result) {
      throw Boom.notFound('Exemption not found')
    }
    return result
  }

  async getExemptionById({ id, currentUserId }) {
    const exemption = await this.#findExemptionById(id)
    if (currentUserId && currentUserId !== exemption.contactId) {
      this.logger.info(
        { exemptionId: id },
        'Authorization error in getExemptionById'
      )
      throw Boom.forbidden('Not authorized to request this resource')
    }
    return exemption
  }

  async getPublicExemptionById(id) {
    const exemption = await this.#findExemptionById(id)
    if (
      exemption.status !== EXEMPTION_STATUS.ACTIVE ||
      exemption.publicRegister?.consent === 'no'
    ) {
      this.logger.info(
        { exemptionId: id },
        'Authorization error in getPublicExemptionById'
      )
      throw Boom.forbidden('Not authorized to request this resource')
    }
    return exemption
  }
}
