import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { getContactNameById } from '../../../shared/common/helpers/dynamics/get-contact-details.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'

import { notAuthorizedMessage } from '../../../shared/constants/errors.js'

export class MarineLicenceService {
  constructor({ db, logger }) {
    this.db = db
    this.logger = logger
  }

  async #findMarineLicenceById(id) {
    const _id = ObjectId.createFromHexString(id)
    const result = await this.db.collection('marine-licences').findOne({ _id })

    if (!result) {
      throw Boom.notFound('Marine Licence not found')
    }
    return result
  }

  async #getWhoMarineLicenceIsFor(marineLicence) {
    return (
      marineLicence.organisation?.name ||
      getContactNameById({ contactId: marineLicence.contactId })
    )
  }

  async getMarineLicenceById({ id, currentUserId }) {
    const marineLicence = await this.#findMarineLicenceById(id)
    if (currentUserId && currentUserId !== marineLicence.contactId) {
      this.logger.info(
        {
          marineLicenceId: id,
          currentUserId,
          marineLicenceContactId: marineLicence.contactId
        },
        'Authorization error in getMarineLicenceById'
      )
      throw Boom.forbidden(notAuthorizedMessage)
    }
    if (!currentUserId) {
      marineLicence.whoMarineLicenceIsFor =
        await this.#getWhoMarineLicenceIsFor(marineLicence)
    }
    return marineLicence
  }

  async getPublicMarineLicenceById(id) {
    const marineLicence = await this.#findMarineLicenceById(id)

    if (marineLicence.status !== MARINE_LICENCE_STATUS.SUBMITTED) {
      this.logger.info(
        { marineLicenceId: id },
        'Authorization error in getPublicMarineLicenceById'
      )
      throw Boom.forbidden(notAuthorizedMessage)
    }

    marineLicence.whoMarineLicenceIsFor =
      await this.#getWhoMarineLicenceIsFor(marineLicence)
    return marineLicence
  }
}
