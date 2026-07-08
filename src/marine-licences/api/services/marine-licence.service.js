import { ObjectId } from 'mongodb'
import Boom from '@hapi/boom'
import { getContactNameById } from '../../../shared/common/helpers/dynamics/get-contact-details.js'
import {
  MARINE_LICENCE_STATUS,
  MARINE_PLAN_POLICY_CONTENT_FIELDS
} from '../../constants/marine-licence.js'
import { notAuthorisedMessage } from '../../../shared/constants/errors.js'
import { collectionMarinePlanPolicyWordingSnapshots } from '../../../shared/common/constants/db-collections.js'

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
    return this.#hydrateMarinePlanPolicies(result)
  }

  // The licence stores { policyCode, sector, wordingRef } pointers; rebuild the
  // full policy objects from the immutable snapshot store so the API response
  // shape is unchanged. Entries without a wordingRef (legacy embedded wording)
  // pass through untouched.
  async #hydrateMarinePlanPolicies(marineLicence) {
    const policies = marineLicence.marinePlanPolicies ?? []
    const refs = policies.filter((p) => p.wordingRef).map((p) => p.wordingRef)
    if (refs.length === 0) {
      return marineLicence
    }

    const snapshots = await this.db
      .collection(collectionMarinePlanPolicyWordingSnapshots)
      .find({ _id: { $in: refs } })
      .toArray()
    const snapshotsByRef = new Map(snapshots.map((s) => [s._id, s]))

    marineLicence.marinePlanPolicies = policies.map((p) => {
      if (!p.wordingRef) {
        return p
      }
      const snapshot = snapshotsByRef.get(p.wordingRef)
      return MARINE_PLAN_POLICY_CONTENT_FIELDS.reduce(
        (policy, field) => {
          // A missing snapshot must never break the read; degrade to empty wording
          policy[field] = snapshot ? snapshot[field] : ''
          return policy
        },
        { policyCode: p.policyCode, sector: p.sector }
      )
    })
    return marineLicence
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
        { event: { action: 'authorization_check', outcome: 'failure' } },
        `Authorization error in getMarineLicenceById: licence ${id}, user ${currentUserId}, owner ${marineLicence.contactId}`
      )
      throw Boom.forbidden(notAuthorisedMessage)
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
        { event: { action: 'authorization_check', outcome: 'failure' } },
        `Authorization error in getPublicMarineLicenceById: licence ${id}`
      )
      throw Boom.forbidden(notAuthorisedMessage)
    }

    marineLicence.whoMarineLicenceIsFor =
      await this.#getWhoMarineLicenceIsFor(marineLicence)
    return marineLicence
  }
}
