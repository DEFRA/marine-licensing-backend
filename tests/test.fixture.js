import { ObjectId } from 'mongodb'
import { EXEMPTION_STATUS } from '../src/exemptions/constants/exemption.js'
import { MARINE_LICENCE_STATUS } from '../src/marine-licences/constants/marine-licence.js'
import { COORDINATE_SYSTEMS } from '../src/shared/common/constants/coordinates.js'

export const mockCredentials = {
  contactId: '123e4567-e89b-12d3-a456-426614174000'
}

export const createCompleteExemption = (overrides = {}) => {
  const exemptionId = overrides._id || new ObjectId()
  const contactId =
    overrides.contactId || '123e4567-e89b-12d3-a456-426614174000'

  return {
    _id: exemptionId,
    contactId,
    organisation: {
      name: 'Test Organisation Ltd',
      id: 'org-123'
    },
    projectName: 'Test Marine Project',
    publicRegister: {
      consent: 'yes'
    },
    multipleSiteDetails: {
      multipleSitesEnabled: false
    },
    siteDetails: [
      {
        coordinatesType: 'coordinates',
        coordinatesEntry: 'single',
        coordinateSystem: COORDINATE_SYSTEMS.WGS84,
        coordinates: {
          latitude: '51.489676',
          longitude: '-0.231530'
        },
        circleWidth: '20',
        activityDates: {
          start: new Date('2027-01-01'),
          end: new Date('2027-12-31')
        },
        activityDescription: 'Test activity description'
      }
    ],
    status: EXEMPTION_STATUS.DRAFT,
    createdAt: new Date('2026-12-01'),
    updatedAt: new Date('2026-12-01'),
    ...overrides
  }
}

export const createCompleteMarineLicence = (overrides = {}) => {
  const marineLicenceId = overrides._id || new ObjectId()
  const contactId =
    overrides.contactId || '123e4567-e89b-12d3-a456-426614174000'

  return {
    _id: marineLicenceId,
    contactId,
    projectName: 'Test Marine Licence Project',
    status: MARINE_LICENCE_STATUS.DRAFT,
    createdAt: new Date('2026-12-01'),
    updatedAt: new Date('2026-12-01'),
    ...overrides
  }
}
