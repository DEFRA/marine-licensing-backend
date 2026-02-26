import { vi } from 'vitest'
import { MarineLicenceService } from './marine-licence.service.js'
import { getContactNameById } from '../../../shared/common/helpers/dynamics/get-contact-details.js'

vi.mock(
  '../../../shared/common/helpers/dynamics/get-contact-details.js',
  () => ({
    getContactNameById: vi.fn().mockResolvedValue('Dave Barnett')
  })
)

describe('MarineLicenceService', () => {
  const marineLicence = {
    _id: '6925a4dfc30cd032d1607963',
    contactId: '9687cdd5-49e7-4508-b56c-08a4d02c43c2',
    projectName: 'Test project',
    status: 'ACTIVE'
  }

  const logger = {
    info: vi.fn(),
    error: vi.fn()
  }

  const marineLicenceIdNotInDb = '1'.repeat(24)

  const createService = (mockMongo, marineLicence) => {
    vi.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        findOne: vi.fn().mockImplementation(({ _id }) => {
          if (_id.toHexString() !== marineLicence._id) {
            return null
          }
          return marineLicence
        })
      }
    })
    return new MarineLicenceService({ db: global.mockMongo, logger })
  }

  test('should initialize with provided db and logger', () => {
    const service = new MarineLicenceService({
      db: global.mockMongo,
      logger
    })
    expect(service.db).toBe(global.mockMongo)
    expect(service.logger).toBe(logger)
  })

  describe('getMarineLicenceById', () => {
    it('should return marine licence with individual contact name, if requested without a contact ID', async () => {
      const MarineLicenceService = createService(
        global.mockMongo,
        marineLicence
      )
      const result = await MarineLicenceService.getMarineLicenceById({
        id: marineLicence._id
      })
      expect(result).toEqual({
        ...marineLicence,
        whoMarineLicenceIsFor: 'Dave Barnett'
      })
    })

    it('should return marine licence with organisation name, if requested without a contact ID', async () => {
      const marineLicenceWithOrg = {
        ...marineLicence,
        organisation: { name: 'Dredging Co' }
      }
      const marineLicenseService = createService(
        global.mockMongo,
        marineLicenceWithOrg
      )
      const result = await marineLicenseService.getMarineLicenceById({
        id: marineLicence._id
      })
      expect(result).toEqual({
        ...marineLicenceWithOrg,
        whoMarineLicenceIsFor: 'Dredging Co'
      })
    })

    it('should return marine licence if requested with a contact ID', async () => {
      const marineLicenseService = createService(
        global.mockMongo,
        marineLicence
      )
      const result = await marineLicenseService.getMarineLicenceById({
        id: marineLicence._id,
        currentUserId: marineLicence.contactId
      })
      expect(result).toEqual(marineLicence)
    })

    it('should throw a not found error if marine licence not found', async () => {
      const marineLicenseService = createService(
        global.mockMongo,
        marineLicence
      )
      await expect(() =>
        marineLicenseService.getMarineLicenceById({
          id: marineLicenceIdNotInDb
        })
      ).rejects.toThrow('Marine Licence not found')

      expect(getContactNameById).not.toHaveBeenCalled()
      expect(global.mockMongo.collection).toHaveBeenCalled()
    })

    it("should throw a not authorized error if the current user is an applicant and didn't create the marine licence", async () => {
      const marineLicenseService = createService(
        global.mockMongo,
        marineLicence
      )
      const currentUserId = '1'
      await expect(() =>
        marineLicenseService.getMarineLicenceById({
          id: marineLicence._id,
          currentUserId
        })
      ).rejects.toThrow('Not authorized to request this resource')

      expect(getContactNameById).not.toHaveBeenCalled()
      expect(global.mockMongo.collection).toHaveBeenCalled()
    })
  })
})
