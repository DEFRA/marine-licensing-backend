import { MARINE_LICENCE_STATUS } from '../constants/marine-licence.js'
import { ObjectId } from 'mongodb'

export const mockMarineLicence = {
  _id: new ObjectId(),
  contactId: 'contact-123-abc',
  projectName: 'Test Marine Licence Project',
  status: MARINE_LICENCE_STATUS.DRAFT,
  createdAt: new Date('2026-12-01'),
  updatedAt: new Date('2026-12-01')
}
