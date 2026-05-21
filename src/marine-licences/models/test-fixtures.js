import { MARINE_LICENCE_STATUS } from '../constants/marine-licence.js'
import { ObjectId } from 'mongodb'

const preferredDates = {
  start: new Date('2027-01-01'),
  end: new Date('2027-12-31')
}

export const mockMarineLicence = {
  _id: new ObjectId(),
  contactId: 'contact-123-abc',
  projectName: 'Test Marine Licence Project',
  publicRegister: {
    consent: 'yes',
    reason: 'Test public register reason'
  },
  preferredDates,
  status: MARINE_LICENCE_STATUS.DRAFT,
  createdAt: new Date('2026-12-01'),
  updatedAt: new Date('2026-12-01')
}
