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

  /**
   * Returns a copy of the exemption with `whoExemptionIsFor` resolved from the
   * organisation name, falling back to the contact name held in Dynamics.
   * The key is omitted entirely when neither yields a name, so consumers see
   * either a name or no field at all - never null.
   */
  async #withWhoExemptionIsFor(exemption) {
    const whoExemptionIsFor =
      exemption.organisation?.name ||
      (await getContactNameById({ contactId: exemption.contactId }))

    return whoExemptionIsFor ? { ...exemption, whoExemptionIsFor } : exemption
  }

  async getExemptionById({ id, currentUserId, currentOrganisationId }) {
    const exemption = await this.#findExemptionById(id)

    const isDraft = exemption.status === EXEMPTION_STATUS.DRAFT

    if (currentUserId) {
      const isOwner = currentUserId === exemption.contactId
      const isSameOrganisation =
        currentOrganisationId &&
        exemption.organisation?.id === currentOrganisationId

      if (!isOwner && !(isSameOrganisation && !isDraft)) {
        this.logger.info(
          { event: { action: 'authorization_check', outcome: 'failure' } },
          `Authorization error in getExemptionById: exemption ${id} status ${exemption.status}, user ${currentUserId} org ${currentOrganisationId}, owner ${exemption.contactId} org ${exemption.organisation?.id}`
        )
        throw Boom.forbidden('Not authorised to request this resource')
      }
    }

    // An applicant viewing their own draft has no summary card to show the name in;
    // every other viewer of every other status does
    const isOwnerViewingDraft = currentUserId && isDraft

    return isOwnerViewingDraft
      ? exemption
      : this.#withWhoExemptionIsFor(exemption)
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
    return this.#withWhoExemptionIsFor(exemption)
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
      return this.#withWhoExemptionIsFor(exemption)
    }
    return exemption
  }
}
