import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'
import { getContactNameById } from '../../../common/helpers/dynamics/get-contact-details.js'

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

  async #getWhoExemptionIsFor(exemption) {
    return (
      exemption.organisation?.name ||
      getContactNameById({ contactId: exemption.contactId })
    )
  }

  async getExemptionById({ id, currentUserId, currentOrganisationId }) {
    const exemption = await this.#findExemptionById(id)

    if (currentUserId) {
      const isOwner = currentUserId === exemption.contactId
      const isSameOrganisation =
        currentOrganisationId &&
        exemption.organisation?.id === currentOrganisationId
      const isSubmitted = exemption.status !== EXEMPTION_STATUS.DRAFT

      if (!isOwner && !(isSameOrganisation && isSubmitted)) {
        this.logger.info(
          {
            exemptionId: id,
            currentUserId,
            currentOrganisationId,
            exemptionContactId: exemption.contactId,
            exemptionOrganisationId: exemption.organisation?.id,
            exemptionStatus: exemption.status
          },
          'Authorization error in getExemptionById'
        )
        throw Boom.forbidden('Not authorized to request this resource')
      }
    }

    if (!currentUserId) {
      exemption.whoExemptionIsFor = await this.#getWhoExemptionIsFor(exemption)
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
    exemption.whoExemptionIsFor = await this.#getWhoExemptionIsFor(exemption)
    return exemption
  }
}
