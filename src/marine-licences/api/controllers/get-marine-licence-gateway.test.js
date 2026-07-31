import { getMarineLicenceGatewayController } from './get-marine-licence-gateway.js'
import { vi } from 'vitest'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { preferredDates } from '../../models/test-fixtures.js'

describe('GET /public/marine-licence/mas/{id}', () => {
  const paramsValidator =
    getMarineLicenceGatewayController.options.validate.params
  const mockId = '123456789123456789123456'

  let mockedFindOne

  beforeEach(() => {
    vi.clearAllMocks()
    mockedFindOne = vi.fn().mockResolvedValue(null)
    vi.spyOn(global.mockMongo, 'collection').mockImplementation(function () {
      return { findOne: mockedFindOne }
    })
  })

  const mockRequest = (overrides = {}) => ({
    params: { id: mockId },
    db: global.mockMongo,
    logger: { info: vi.fn(), error: vi.fn() },
    ...overrides
  })

  describe('Validation', () => {
    it('should fail if id is missing', () => {
      const result = paramsValidator.validate({})

      expect(result.error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
    })

    it('should fail if id has incorrect length', () => {
      const result = paramsValidator.validate({ id: '123' })

      expect(result.error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
    })

    it('should fail if id has incorrect characters', () => {
      const result = paramsValidator.validate({ id: mockId.replace('1', '+') })

      expect(result.error.message).toContain('MARINE_LICENCE_ID_INVALID')
    })
  })

  describe('Handler', () => {
    it('should return 404 if ID does not exist', async () => {
      const { mockHandler } = global

      mockedFindOne.mockResolvedValue(null)

      await expect(
        getMarineLicenceGatewayController.handler(mockRequest(), mockHandler)
      ).rejects.toThrow('Marine licence not found')
    })

    it('should return forbidden if status is DRAFT', async () => {
      const { mockHandler } = global

      mockedFindOne.mockResolvedValue({
        _id: mockId,
        projectName: 'Test project',
        projectBackground: 'Background',
        preferredDates,
        status: MARINE_LICENCE_STATUS.DRAFT
      })

      await expect(
        getMarineLicenceGatewayController.handler(mockRequest(), mockHandler)
      ).rejects.toThrow('Not authorised to request this resource')
    })

    it('should return project fields for a non-draft marine licence', async () => {
      const { mockHandler } = global

      mockedFindOne.mockResolvedValue({
        _id: mockId,
        projectName: 'Test project',
        projectBackground: 'Test project background',
        preferredDates: {
          start: { month: '08', year: '2026' },
          end: { month: '11', year: '2026' }
        },
        publicRegister: {
          consent: 'no',
          reason: 'Commercial confidentiality'
        },
        specialLegalPowers: {
          agree: 'yes',
          details: 'Harbour powers under local Act'
        },
        harbourAuthority: {
          area: 'yes',
          details: 'Port of Example'
        },
        otherAuthorities: {
          agree: 'yes',
          details: 'Planning permission from local authority'
        },
        publicConsultation: {
          consulted: 'yes',
          details: 'Consultation with stakeholders'
        },
        status: MARINE_LICENCE_STATUS.SUBMITTED
      })

      await getMarineLicenceGatewayController.handler(
        mockRequest(),
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith({
        projectName: 'Test project',
        projectBackground: 'Test project background',
        preferredLicenceDates: 'August 2026 to November 2026',
        publicRegister: {
          consent: 'no',
          reason: 'Commercial confidentiality'
        },
        specialLegalPowers: {
          agree: 'yes',
          details: 'Harbour powers under local Act'
        },
        harbourAuthority: {
          area: 'yes',
          details: 'Port of Example'
        },
        otherAuthorities: {
          agree: 'yes',
          details: 'Planning permission from local authority'
        },
        publicConsultation: {
          consulted: 'yes',
          details: 'Consultation with stakeholders'
        }
      })
    })

    it('should return nulls when optional fields are missing', async () => {
      const { mockHandler } = global

      mockedFindOne.mockResolvedValue({
        _id: mockId,
        status: MARINE_LICENCE_STATUS.SUBMITTED
      })

      await getMarineLicenceGatewayController.handler(
        mockRequest(),
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith({
        projectName: null,
        projectBackground: null,
        preferredLicenceDates: null,
        publicRegister: null,
        specialLegalPowers: null,
        harbourAuthority: null,
        otherAuthorities: null,
        publicConsultation: null
      })
    })
  })
})
