import { MARINE_LICENSE_STATUS } from '../constants/marine-license.js'
import { ObjectId } from 'mongodb'

export const mockMarineLicense = {
  _id: new ObjectId(),
  contactId: 'contact-123-abc',
  projectName: 'Test Marine License Project',
  status: MARINE_LICENSE_STATUS.DRAFT,
  createdAt: new Date('2026-12-01'),
  updatedAt: new Date('2026-12-01')
}
