import { vi } from 'vitest'
import { MarineLicenseService } from './marine-license.service.js'

vi.mock('../../../common/helpers/dynamics/get-contact-details.js', () => ({
  getContactNameById: vi.fn().mockResolvedValue('Dave Barnett')
}))

describe('MarineLicenseService', () => {
  const marineLicense = {
    _id: '6925a4dfc30cd032d1607963',
    contactId: '9687cdd5-49e7-4508-b56c-08a4d02c43c2',
    projectName: 'Test project',
    status: 'ACTIVE'
  }

  const logger = {
    info: vi.fn(),
    error: vi.fn()
  }

  const marineLicenseIdNotInDb = '1'.repeat(24)

  const createService = (mockMongo, marineLicense) => {
    vi.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        findOne: vi.fn().mockImplementation(({ _id }) => {
          if (_id.toHexString() !== marineLicense._id) {
            return null
          }
          return marineLicense
        })
      }
    })
    return new MarineLicenseService({ db: global.mockMongo, logger })
  }

  test('should initialize with provided db and logger', () => {
    const service = new MarineLicenseService({
      db: global.mockMongo,
      logger
    })
    expect(service.db).toBe(global.mockMongo)
    expect(service.logger).toBe(logger)
  })

  describe('getMarineLicenseById', () => {
    it('should return marine license with individual contact name, if requested without a contact ID', async () => {
      const marineLicenseService = createService(
        global.mockMongo,
        marineLicense
      )
      const result = await marineLicenseService.getMarineLicenseById({
        id: marineLicense._id
      })
      expect(result).toEqual({
        ...marineLicense,
        whoMarineLicenseIsFor: 'Dave Barnett'
      })
    })

    it('should return marine license with organisation name, if requested without a contact ID', async () => {
      const marineLicenseWithOrg = {
        ...marineLicense,
        organisation: { name: 'Dredging Co' }
      }
      const marineLicenseService = createService(
        global.mockMongo,
        marineLicenseWithOrg
      )
      const result = await marineLicenseService.getMarineLicenseById({
        id: marineLicense._id
      })
      expect(result).toEqual({
        ...marineLicenseWithOrg,
        whoMarineLicenseIsFor: 'Dredging Co'
      })
    })

    it('should return marine license if requested with a contact ID', async () => {
      const marineLicenseService = createService(
        global.mockMongo,
        marineLicense
      )
      const result = await marineLicenseService.getMarineLicenseById({
        id: marineLicense._id,
        currentUserId: marineLicense.contactId
      })
      expect(result).toEqual(marineLicense)
    })

    it('should throw a not found error if marine license not found', async () => {
      const marineLicenseService = createService(
        global.mockMongo,
        marineLicense
      )
      await expect(() =>
        marineLicenseService.getMarineLicenseById({
          id: marineLicenseIdNotInDb
        })
      ).rejects.toThrow('Marine License not found')
    })

    it("should throw a not authorized error if the current user is an applicant and didn't create the marine license", async () => {
      const marineLicenseService = createService(
        global.mockMongo,
        marineLicense
      )
      const currentUserId = '1'
      await expect(() =>
        marineLicenseService.getMarineLicenseById({
          id: marineLicense._id,
          currentUserId
        })
      ).rejects.toThrow('Not authorized to request this resource')
    })
  })
})
