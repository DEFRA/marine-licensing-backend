import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { getContactNameById } from '../../../shared/common/helpers/dynamics/get-contact-details.js'

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
      throw Boom.forbidden('Not authorized to request this resource')
    }
    if (!currentUserId) {
      marineLicence.whomarineLicenceIsFor =
        await this.#getWhoMarineLicenceIsFor(marineLicence)
    }
    return marineLicence
  }
}
