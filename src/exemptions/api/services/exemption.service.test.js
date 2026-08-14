import { vi, expect } from 'vitest'
import { ExemptionService } from './exemption.service.js'
import { getContactNameById } from '../../../shared/common/helpers/dynamics/get-contact-details.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'

vi.mock(
  '../../../shared/common/helpers/dynamics/get-contact-details.js',
  () => ({
    getContactNameById: vi.fn().mockResolvedValue('Dave Barnett')
  })
)

describe('ExemptionService', () => {
  const exemption = {
    _id: '6925a4dfc30cd032d1607963',
    contactId: '9687cdd5-49e7-4508-b56c-08a4d02c43c2',
    projectName: 'Test project',
    status: EXEMPTION_STATUS.ACTIVE,
    publicRegister: { consent: 'yes' },
    applicationReference: 'EXE/2026/10006'
  }

  const buildExemption = (overrides = {}) => ({ ...exemption, ...overrides })

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
      ).rejects.toThrow('Not authorised to request this resource')
    })

    it('should allow colleague from same organisation to view submitted exemption', async () => {
      const orgId = 'org-123'
      const exemptionWithOrg = buildExemption({
        status: EXEMPTION_STATUS.ACTIVE,
        organisation: { id: orgId, name: 'Test Org' }
      })
      const exemptionService = createService(global.mockMongo, exemptionWithOrg)
      const result = await exemptionService.getExemptionById({
        id: exemption._id,
        currentUserId: 'different-user',
        currentOrganisationId: orgId
      })
      expect(result).toEqual({
        ...exemptionWithOrg,
        whoExemptionIsFor: 'Test Org'
      })
    })

    it('should not allow colleague from same organisation to view draft exemption', async () => {
      const orgId = 'org-123'
      const draftExemptionWithOrg = buildExemption({
        status: EXEMPTION_STATUS.DRAFT,
        organisation: { id: orgId, name: 'Test Org' }
      })
      const exemptionService = createService(
        global.mockMongo,
        draftExemptionWithOrg
      )
      await expect(() =>
        exemptionService.getExemptionById({
          id: exemption._id,
          currentUserId: 'different-user',
          currentOrganisationId: orgId
        })
      ).rejects.toThrow('Not authorised to request this resource')
    })

    it('should not allow user from different organisation to view exemption', async () => {
      const exemptionWithOrg = buildExemption({
        status: EXEMPTION_STATUS.ACTIVE,
        organisation: { id: 'org-123', name: 'Test Org' }
      })
      const exemptionService = createService(global.mockMongo, exemptionWithOrg)
      await expect(() =>
        exemptionService.getExemptionById({
          id: exemption._id,
          currentUserId: 'different-user',
          currentOrganisationId: 'different-org'
        })
      ).rejects.toThrow('Not authorised to request this resource')
    })

    describe('whoExemptionIsFor', () => {
      it('should look up the contact name for an applicant viewing their own submitted exemption', async () => {
        const submitted = buildExemption({ status: EXEMPTION_STATUS.ACTIVE })
        const exemptionService = createService(global.mockMongo, submitted)

        const result = await exemptionService.getExemptionById({
          id: exemption._id,
          currentUserId: exemption.contactId
        })

        expect(getContactNameById).toHaveBeenCalledWith({
          contactId: exemption.contactId
        })
        expect(result).toEqual({
          ...submitted,
          whoExemptionIsFor: 'Dave Barnett'
        })
        // the document read from the database is not mutated
        expect(submitted).not.toHaveProperty('whoExemptionIsFor')
      })

      it('should use the organisation name in preference to the contact name', async () => {
        const submitted = buildExemption({
          status: EXEMPTION_STATUS.ACTIVE,
          organisation: { id: 'org-123', name: 'Dredging Co' }
        })
        const exemptionService = createService(global.mockMongo, submitted)

        const result = await exemptionService.getExemptionById({
          id: exemption._id,
          currentUserId: exemption.contactId
        })

        expect(getContactNameById).not.toHaveBeenCalled()
        expect(result).toEqual({
          ...submitted,
          whoExemptionIsFor: 'Dredging Co'
        })
      })

      it('should not look up the contact name for an applicant viewing a draft exemption', async () => {
        const draft = buildExemption({ status: EXEMPTION_STATUS.DRAFT })
        const exemptionService = createService(global.mockMongo, draft)

        const result = await exemptionService.getExemptionById({
          id: exemption._id,
          currentUserId: exemption.contactId
        })

        expect(getContactNameById).not.toHaveBeenCalled()
        expect(result.whoExemptionIsFor).toBeUndefined()
      })

      it('should omit whoExemptionIsFor when no name is available', async () => {
        // getContactNameById returns null when Dynamics is disabled or the call fails
        vi.mocked(getContactNameById).mockResolvedValueOnce(null)
        const submitted = buildExemption({ status: EXEMPTION_STATUS.ACTIVE })
        const exemptionService = createService(global.mockMongo, submitted)

        const result = await exemptionService.getExemptionById({
          id: exemption._id,
          currentUserId: exemption.contactId
        })

        expect(result).not.toHaveProperty('whoExemptionIsFor')
      })

      it('should look up the contact name for an internal user viewing a draft exemption', async () => {
        const draft = buildExemption({ status: EXEMPTION_STATUS.DRAFT })
        const exemptionService = createService(global.mockMongo, draft)

        const result = await exemptionService.getExemptionById({
          id: exemption._id
        })

        expect(getContactNameById).toHaveBeenCalledWith({
          contactId: exemption.contactId
        })
        expect(result.whoExemptionIsFor).toBe('Dave Barnett')
      })

      it('should look up the contact name for a colleague viewing a submitted organisation exemption', async () => {
        const orgId = 'org-123'
        const submitted = buildExemption({
          status: EXEMPTION_STATUS.ACTIVE,
          organisation: { id: orgId }
        })
        const exemptionService = createService(global.mockMongo, submitted)

        const result = await exemptionService.getExemptionById({
          id: exemption._id,
          currentUserId: 'different-user',
          currentOrganisationId: orgId
        })

        expect(getContactNameById).toHaveBeenCalledWith({
          contactId: exemption.contactId
        })
        expect(result.whoExemptionIsFor).toBe('Dave Barnett')
      })
    })
  })

  describe('getPublicExemptionById', () => {
    it('should return exemption if found', async () => {
      const exemptionService = createService(global.mockMongo, exemption)
      const result = await exemptionService.getPublicExemptionById(
        exemption._id
      )
      expect(result).toEqual({
        ...exemption,
        whoExemptionIsFor: 'Dave Barnett'
      })
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
      const exemptionService = createService(
        global.mockMongo,
        buildExemption({ publicRegister: { consent: 'no' } })
      )
      await expect(() =>
        exemptionService.getPublicExemptionById(exemption._id)
      ).rejects.toThrow('Not authorised to request this resource')
    })

    it('should throw an unauthorized error if exemption is not active', async () => {
      const exemptionService = createService(
        global.mockMongo,
        buildExemption({ status: EXEMPTION_STATUS.DRAFT })
      )
      await expect(() =>
        exemptionService.getPublicExemptionById(exemption._id)
      ).rejects.toThrow('Not authorised to request this resource')
    })

    it('should return withdrawn exemption with public consent', async () => {
      const withdrawnExemption = buildExemption({
        status: EXEMPTION_STATUS.WITHDRAWN,
        publicRegister: { consent: 'yes' }
      })
      const exemptionService = createService(
        global.mockMongo,
        withdrawnExemption
      )
      const result = await exemptionService.getPublicExemptionById(
        exemption._id
      )
      expect(result).toEqual({
        ...withdrawnExemption,
        whoExemptionIsFor: 'Dave Barnett'
      })
    })

    it('should throw forbidden for withdrawn exemption without public consent', async () => {
      const exemptionService = createService(
        global.mockMongo,
        buildExemption({
          status: EXEMPTION_STATUS.WITHDRAWN,
          publicRegister: { consent: 'no' }
        })
      )
      await expect(() =>
        exemptionService.getPublicExemptionById(exemption._id)
      ).rejects.toThrow('Not authorised to request this resource')
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
      const exemptionWithOrg = buildExemption({
        organisation: { name: 'Dredging Co' }
      })
      const exemptionService = createService(global.mockMongo, exemptionWithOrg)
      const result = await exemptionService.getExemptionByApplicationReference({
        applicationReference: exemption.applicationReference
      })
      expect(result).toEqual({
        ...exemptionWithOrg,
        whoExemptionIsFor: 'Dredging Co'
      })
    })

    it('should return exemption without a contact name for its owner', async () => {
      const exemptionService = createService(global.mockMongo, exemption)
      const result = await exemptionService.getExemptionByApplicationReference({
        applicationReference: exemption.applicationReference,
        currentUserId: exemption.contactId
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
      ).rejects.toThrow('Not authorised to request this resource')
    })
  })
})
