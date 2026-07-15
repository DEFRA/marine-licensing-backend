import { vi } from 'vitest'
import { MarineLicenceService } from './marine-licence.service.js'
import { getContactNameById } from '../../../shared/common/helpers/dynamics/get-contact-details.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { collectionMarinePlanPolicyWordingSnapshots } from '../../../shared/common/constants/db-collections.js'

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
    status: MARINE_LICENCE_STATUS.SUBMITTED
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
      const marineLicenceService = createService(
        global.mockMongo,
        marineLicenceWithOrg
      )
      const result = await marineLicenceService.getMarineLicenceById({
        id: marineLicence._id
      })
      expect(result).toEqual({
        ...marineLicenceWithOrg,
        whoMarineLicenceIsFor: 'Dredging Co'
      })
    })

    it('should return marine licence if requested with a contact ID', async () => {
      const marineLicenceService = createService(
        global.mockMongo,
        marineLicence
      )
      const result = await marineLicenceService.getMarineLicenceById({
        id: marineLicence._id,
        currentUserId: marineLicence.contactId
      })
      expect(result).toEqual(marineLicence)
    })

    it('should throw a not found error if marine licence not found', async () => {
      const marineLicenceService = createService(
        global.mockMongo,
        marineLicence
      )
      await expect(() =>
        marineLicenceService.getMarineLicenceById({
          id: marineLicenceIdNotInDb
        })
      ).rejects.toThrow('Marine Licence not found')

      expect(getContactNameById).not.toHaveBeenCalled()
      expect(global.mockMongo.collection).toHaveBeenCalled()
    })

    it("should throw a not authorized error if the current user is an applicant and didn't create the marine licence", async () => {
      const marineLicenceService = createService(
        global.mockMongo,
        marineLicence
      )
      const currentUserId = '1'
      await expect(() =>
        marineLicenceService.getMarineLicenceById({
          id: marineLicence._id,
          currentUserId
        })
      ).rejects.toThrow('Not authorised to request this resource')

      expect(getContactNameById).not.toHaveBeenCalled()
      expect(global.mockMongo.collection).toHaveBeenCalled()
    })
  })

  describe('getPublicMarineLicenceById', () => {
    it('should return marine licence with whoMarineLicenceIsFor when status is SUBMITTED', async () => {
      const marineLicenceService = createService(
        global.mockMongo,
        marineLicence
      )
      const result = await marineLicenceService.getPublicMarineLicenceById(
        marineLicence._id
      )
      expect(result).toEqual({
        ...marineLicence,
        whoMarineLicenceIsFor: 'Dave Barnett'
      })
    })

    it('should throw a not found error if marine licence not found', async () => {
      const marineLicenceService = createService(
        global.mockMongo,
        marineLicence
      )
      await expect(() =>
        marineLicenceService.getPublicMarineLicenceById(marineLicenceIdNotInDb)
      ).rejects.toThrow('Marine Licence not found')
    })

    it('should throw a forbidden error if status is not SUBMITTED', async () => {
      const draftLicence = {
        ...marineLicence,
        status: MARINE_LICENCE_STATUS.DRAFT
      }
      const marineLicenceService = createService(global.mockMongo, draftLicence)
      await expect(() =>
        marineLicenceService.getPublicMarineLicenceById(marineLicence._id)
      ).rejects.toThrow('Not authorised to request this resource')

      expect(getContactNameById).not.toHaveBeenCalled()
    })
  })

  describe('marine plan policy hydration', () => {
    const wording = {
      policy: '<p>statement</p>',
      policyAim: '<p>aim</p>',
      whatIsIt: '<p>what</p>',
      whyIsItImportant: null,
      howWillThisBeImplemented: '<p>how</p>'
    }
    const wordingRef = 'E-AGG-1@a1b2c3d4e5f6'

    const createServiceWithSnapshots = (licence, snapshotRows) => {
      const mockSnapshotFind = vi.fn().mockReturnValue({
        project: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(snapshotRows)
        })
      })
      vi.spyOn(global.mockMongo, 'collection').mockImplementation((name) => {
        if (name === collectionMarinePlanPolicyWordingSnapshots) {
          return { find: mockSnapshotFind }
        }
        return { findOne: vi.fn().mockResolvedValue(licence) }
      })
      const service = new MarineLicenceService({
        db: global.mockMongo,
        logger
      })
      return { service, mockSnapshotFind }
    }

    it('should rehydrate pointer policies to the full legacy shape, wording fields verbatim', async () => {
      const licence = {
        ...marineLicence,
        marinePlanPolicies: [
          { policyCode: 'E-AGG-1', sector: 'Aggregates', wordingRef }
        ]
      }
      const { service, mockSnapshotFind } = createServiceWithSnapshots(
        licence,
        [{ _id: wordingRef, policyCode: 'E-AGG-1', ...wording }]
      )

      const result = await service.getMarineLicenceById({
        id: marineLicence._id,
        currentUserId: marineLicence.contactId
      })

      expect(mockSnapshotFind).toHaveBeenCalledWith({
        _id: { $in: [wordingRef] }
      })
      expect(result.marinePlanPolicies).toEqual([
        { policyCode: 'E-AGG-1', sector: 'Aggregates', ...wording }
      ])
    })

    it('should pass legacy embedded policies through unchanged without querying snapshots', async () => {
      const embedded = {
        policyCode: 'E-AGG-1',
        sector: 'Aggregates',
        ...wording
      }
      const licence = { ...marineLicence, marinePlanPolicies: [embedded] }
      const { service, mockSnapshotFind } = createServiceWithSnapshots(
        licence,
        []
      )

      const result = await service.getMarineLicenceById({
        id: marineLicence._id,
        currentUserId: marineLicence.contactId
      })

      expect(mockSnapshotFind).not.toHaveBeenCalled()
      expect(result.marinePlanPolicies).toEqual([embedded])
    })

    it('should hydrate pointer policies while passing mixed-in legacy embedded policies through unchanged', async () => {
      const embedded = {
        policyCode: 'E-FISH-1',
        sector: 'Fishing',
        ...wording
      }
      const licence = {
        ...marineLicence,
        marinePlanPolicies: [
          embedded,
          { policyCode: 'E-AGG-1', sector: 'Aggregates', wordingRef }
        ]
      }
      const { service, mockSnapshotFind } = createServiceWithSnapshots(
        licence,
        [{ _id: wordingRef, policyCode: 'E-AGG-1', ...wording }]
      )

      const result = await service.getMarineLicenceById({
        id: marineLicence._id,
        currentUserId: marineLicence.contactId
      })

      expect(mockSnapshotFind).toHaveBeenCalledWith({
        _id: { $in: [wordingRef] }
      })
      expect(result.marinePlanPolicies).toEqual([
        embedded,
        { policyCode: 'E-AGG-1', sector: 'Aggregates', ...wording }
      ])
    })

    it('should degrade a dangling wordingRef to empty wording instead of failing', async () => {
      const licence = {
        ...marineLicence,
        marinePlanPolicies: [
          { policyCode: 'E-AGG-1', sector: 'Aggregates', wordingRef }
        ]
      }
      const { service } = createServiceWithSnapshots(licence, [])

      const result = await service.getMarineLicenceById({
        id: marineLicence._id,
        currentUserId: marineLicence.contactId
      })

      expect(result.marinePlanPolicies).toEqual([
        {
          policyCode: 'E-AGG-1',
          sector: 'Aggregates',
          policy: '',
          policyAim: '',
          whatIsIt: '',
          whyIsItImportant: '',
          howWillThisBeImplemented: ''
        }
      ])
    })

    it('should hydrate on the public read path too', async () => {
      const licence = {
        ...marineLicence,
        marinePlanPolicies: [
          { policyCode: 'E-AGG-1', sector: 'Aggregates', wordingRef }
        ]
      }
      const { service } = createServiceWithSnapshots(licence, [
        { _id: wordingRef, policyCode: 'E-AGG-1', ...wording }
      ])

      const result = await service.getPublicMarineLicenceById(marineLicence._id)

      expect(result.marinePlanPolicies).toEqual([
        { policyCode: 'E-AGG-1', sector: 'Aggregates', ...wording }
      ])
    })
  })
})
