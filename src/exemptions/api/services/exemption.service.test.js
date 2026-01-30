import { vi } from 'vitest'
import { ExemptionService } from './exemption.service.js'

vi.mock('../../../shared/common/helpers/dynamics/get-contact-details.js', () => ({
  getContactNameById: vi.fn().mockResolvedValue('Dave Barnett')
}))

describe('ExemptionService', () => {
  const exemption = {
    _id: '6925a4dfc30cd032d1607963',
    contactId: '9687cdd5-49e7-4508-b56c-08a4d02c43c2',
    projectName: 'Test project',
    status: 'ACTIVE',
    publicRegister: { consent: 'yes' },
    applicationReference: 'EXE/2026/10006'
  }

  const logger = {
    info: vi.fn(),
    error: vi.fn()
  }

  const exemptionIdNotInDb = '1'.repeat(24)

  const createService = (mockMongo, exemption) => {
    vi.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        findOne: vi.fn().mockImplementation(({ _id, applicationReference }) => {
          if (
            (_id && _id.toHexString() !== exemption._id) ||
            (applicationReference &&
              applicationReference !== exemption.applicationReference)
          ) {
            return null
          }
          return exemption
        })
      }
    })
    return new ExemptionService({ db: global.mockMongo, logger })
  }

  test('should initialize with provided db and logger', () => {
    const service = new ExemptionService({ db: global.mockMongo, logger })
    expect(service.db).toBe(global.mockMongo)
    expect(service.logger).toBe(logger)
  })

  describe('getExemptionById', () => {
    it('should return exemption with individual contact name, if requested without a contact ID', async () => {
      const exemptionService = createService(global.mockMongo, exemption)
      const result = await exemptionService.getExemptionById({
        id: exemption._id
      })
      expect(result).toEqual({
        ...exemption,
        whoExemptionIsFor: 'Dave Barnett'
      })
    })

    it('should return exemption with organisation name, if requested without a contact ID', async () => {
      const exemptionWithOrg = {
        ...exemption,
        organisation: { name: 'Dredging Co' }
      }
      const exemptionService = createService(global.mockMongo, exemptionWithOrg)
      const result = await exemptionService.getExemptionById({
        id: exemption._id
      })
      expect(result).toEqual({
        ...exemptionWithOrg,
        whoExemptionIsFor: 'Dredging Co'
      })
    })

    it('should return exemption if requested with a contact ID', async () => {
      const exemptionService = createService(global.mockMongo, exemption)
      const result = await exemptionService.getExemptionById({
        id: exemption._id,
        contactId: exemption.contactId
      })
      expect(result).toEqual(exemption)
    })

    it('should throw a not found error if exemption not found', async () => {
      const exemptionService = createService(global.mockMongo, exemption)
      await expect(() =>
        exemptionService.getExemptionById({ id: exemptionIdNotInDb })
      ).rejects.toThrow(
        '#findExemptionById not found for id 111111111111111111111111'
      )
    })

    it("should throw a not authorized error if the current user is an applicant and didn't create the exemption", async () => {
      const exemptionService = createService(global.mockMongo, exemption)
      const currentUserId = '1'
      await expect(() =>
        exemptionService.getExemptionById({ id: exemption._id, currentUserId })
      ).rejects.toThrow('Not authorized to request this resource')
    })
  })

  describe('getPublicExemptionById', () => {
    it('should return exemption if found', async () => {
      const exemptionService = createService(global.mockMongo, exemption)
      const result = await exemptionService.getPublicExemptionById(
        exemption._id
      )
      expect(result).toEqual(exemption)
    })

    it('should throw a not found error if exemption not found', async () => {
      const exemptionService = createService(global.mockMongo, exemption)
      await expect(() =>
        exemptionService.getPublicExemptionById(exemptionIdNotInDb)
      ).rejects.toThrow(
        '#findExemptionById not found for id 111111111111111111111111'
      )
    })

    it('should throw an unauthorized error if exemption is not public', async () => {
      const exemptionService = createService(global.mockMongo, {
        ...exemption,
        publicRegister: { consent: 'no' }
      })
      await expect(() =>
        exemptionService.getPublicExemptionById(exemption._id)
      ).rejects.toThrow('Not authorized to request this resource')
    })

    it('should throw an unauthorized error if exemption is not active', async () => {
      const exemptionService = createService(global.mockMongo, {
        ...exemption,
        status: 'DRAFT'
      })
      await expect(() =>
        exemptionService.getPublicExemptionById(exemption._id)
      ).rejects.toThrow('Not authorized to request this resource')
    })
  })

  describe('getExemptionByApplicationReference', () => {
    it('should return exemption with individual contact name, if requested without a contact ID', async () => {
      const exemptionService = createService(global.mockMongo, exemption)
      const result = await exemptionService.getExemptionByApplicationReference({
        applicationReference: exemption.applicationReference
      })
      expect(result).toEqual({
        ...exemption,
        whoExemptionIsFor: 'Dave Barnett'
      })
    })

    it('should return exemption with organisation name, if requested without a contact ID', async () => {
      const exemptionWithOrg = {
        ...exemption,
        organisation: { name: 'Dredging Co' }
      }
      const exemptionService = createService(global.mockMongo, exemptionWithOrg)
      const result = await exemptionService.getExemptionByApplicationReference({
        applicationReference: exemption.applicationReference
      })
      expect(result).toEqual({
        ...exemptionWithOrg,
        whoExemptionIsFor: 'Dredging Co'
      })
    })

    it('should return exemption if requested with a contact ID', async () => {
      const exemptionService = createService(global.mockMongo, exemption)
      const result = await exemptionService.getExemptionByApplicationReference({
        applicationReference: exemption.applicationReference,
        contactId: exemption.contactId
      })
      expect(result).toEqual(exemption)
    })

    it('should throw a not found error if exemption not found', async () => {
      const exemptionService = createService(global.mockMongo, exemption)
      await expect(() =>
        exemptionService.getExemptionByApplicationReference({
          applicationReference: 'blah'
        })
      ).rejects.toThrow(
        '#findExemptionByApplicationReference not found for blah'
      )
    })

    it("should throw a not authorized error if the current user is an applicant and didn't create the exemption", async () => {
      const exemptionService = createService(global.mockMongo, exemption)
      const currentUserId = '1'
      await expect(() =>
        exemptionService.getExemptionByApplicationReference({
          applicationReference: exemption.applicationReference,
          currentUserId
        })
      ).rejects.toThrow('Not authorized to request this resource')
    })
  })
})
