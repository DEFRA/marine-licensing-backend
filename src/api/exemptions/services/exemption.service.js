import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { EXEMPTION_STATUS } from '../../../common/constants/exemption.js'
import { collectionExemptions } from '../../../common/constants/db-collections.js'
import { getContactNameById } from '../../../common/helpers/dynamics/get-contact-details.js'

const notAuthorizedMessage = 'Not authorized to request this resource'

export class ExemptionService {
  constructor({ db, logger }) {
    this.db = db
    this.logger = logger
  }

  async #findExemptionById(id) {
    const _id = ObjectId.createFromHexString(id)
    const result = await this.db
      .collection(collectionExemptions)
      .findOne({ _id })

    if (!result) {
      throw Boom.notFound(`#findExemptionById not found for id ${id}`)
    }
    return result
  }

  async #findExemptionByApplicationReference(applicationReference) {
    const result = await this.db
      .collection(collectionExemptions)
      .findOne({ applicationReference })

    if (!result) {
      throw Boom.notFound(
        `#findExemptionByApplicationReference not found for ${applicationReference}`
      )
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
    const isViewableStatus =
      exemption.status === EXEMPTION_STATUS.ACTIVE ||
      exemption.status === EXEMPTION_STATUS.WITHDRAWN

    if (!isViewableStatus || exemption.publicRegister?.consent === 'no') {
      this.logger.info(
        { exemptionId: id },
        'Authorization error in getPublicExemptionById'
      )
      throw Boom.forbidden(notAuthorizedMessage)
    }
    exemption.whoExemptionIsFor = await this.#getWhoExemptionIsFor(exemption)
    return exemption
  }

  async getExemptionByApplicationReference({
    applicationReference,
    currentUserId
  }) {
    const exemption =
      await this.#findExemptionByApplicationReference(applicationReference)
    if (currentUserId && currentUserId !== exemption.contactId) {
      this.logger.info(
        {
          applicationReference,
          currentUserId,
          exemptionContactId: exemption.contactId
        },
        'Authorization error in getExemptionByApplicationReference'
      )
      throw Boom.forbidden(notAuthorizedMessage)
    }
    if (!currentUserId) {
      exemption.whoExemptionIsFor = await this.#getWhoExemptionIsFor(exemption)
    }
    return exemption
  }
}
