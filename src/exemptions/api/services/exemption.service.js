import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import { collectionExemptions } from '../../../shared/common/constants/db-collections.js'
import { getContactNameById } from '../../../shared/common/helpers/dynamics/get-contact-details.js'
import { notAuthorisedMessage } from '../../../shared/constants/errors.js'

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
          { event: { action: 'authorization_check', outcome: 'failure' } },
          `Authorization error in getExemptionById: exemption ${id} status ${exemption.status}, user ${currentUserId} org ${currentOrganisationId}, owner ${exemption.contactId} org ${exemption.organisation?.id}`
        )
        throw Boom.forbidden('Not authorised to request this resource')
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

    if (!isViewableStatus || exemption.publicRegister?.consent !== 'yes') {
      this.logger.info(
        { event: { action: 'authorization_check', outcome: 'failure' } },
        `Authorization error in getPublicExemptionById: exemption ${id}`
      )
      throw Boom.forbidden(notAuthorisedMessage)
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
        { event: { action: 'authorization_check', outcome: 'failure' } },
        `Authorization error in getExemptionByApplicationReference: ref ${applicationReference}, user ${currentUserId}, owner ${exemption.contactId}`
      )
      throw Boom.forbidden(notAuthorisedMessage)
    }
    if (!currentUserId) {
      exemption.whoExemptionIsFor = await this.#getWhoExemptionIsFor(exemption)
    }
    return exemption
  }
}
