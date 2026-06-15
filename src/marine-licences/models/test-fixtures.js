import { MARINE_LICENCE_STATUS } from '../constants/marine-licence.js'
import { ObjectId } from 'mongodb'

export const preferredDates = {
  start: { month: '01', year: '2027' },
  end: { month: '12', year: '2027' }
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
