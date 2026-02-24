import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { getContactNameById } from '../../../shared/common/helpers/dynamics/get-contact-details.js'

export class MarineLicenseService {
  constructor({ db, logger }) {
    this.db = db
    this.logger = logger
  }

  async #findMarineLicenseById(id) {
    const _id = ObjectId.createFromHexString(id)
    const result = await this.db.collection('marine-licenses').findOne({ _id })

    if (!result) {
      throw Boom.notFound('Marine License not found')
    }
    return result
  }

  async #getWhoMarineLicenseIsFor(marineLicense) {
    return (
      marineLicense.organisation?.name ||
      getContactNameById({ contactId: marineLicense.contactId })
    )
  }

  async getMarineLicenseById({ id, currentUserId }) {
    const marineLicense = await this.#findMarineLicenseById(id)
    if (currentUserId && currentUserId !== marineLicense.contactId) {
      this.logger.info(
        {
          marineLicenseId: id,
          currentUserId,
          marineLicenseContactId: marineLicense.contactId
        },
        'Authorization error in getMarineLicenseById'
      )
      throw Boom.forbidden('Not authorized to request this resource')
    }
    if (!currentUserId) {
      marineLicense.whoMarineLicenseIsFor =
        await this.#getWhoMarineLicenseIsFor(marineLicense)
    }
    return marineLicense
  }
}
