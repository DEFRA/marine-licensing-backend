import { getMarineLicenceGatewayController } from './get-marine-licence-gateway.js'
import { vi } from 'vitest'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { preferredDates } from '../../models/test-fixtures.js'
import { blobService } from '../../../shared/services/data-service/blob-service.js'

vi.mock('../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    getPresignedUrl: vi.fn()
  }
}))

describe('GET /public/marine-licence/mas/{id}', () => {
  const paramsValidator =
    getMarineLicenceGatewayController.options.validate.params
  const mockId = '123456789123456789123456'
  const backendGatewayUrl = 'http://localhost:3001'

  let mockedFindOne

  beforeEach(() => {
    vi.clearAllMocks()
    mockedFindOne = vi.fn().mockResolvedValue(null)
    vi.spyOn(global.mockMongo, 'collection').mockImplementation(function () {
      return { findOne: mockedFindOne }
    })
    blobService.getPresignedUrl.mockResolvedValue(
      'https://s3.example.com/default-presigned'
    )
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
        waterFrameworkDirective: {
          nauticalMile: 'yes',
          excludedActivities: 'no',
          uploadedFile: { filename: 'wfd-assessment.docx' },
          s3Location: {
            s3Bucket: 'mmo-uploads',
            s3Key: 'exemptions/file-id'
          }
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
        },
        waterFrameworkDirective: {
          nauticalMile: 'yes',
          excludedActivities: 'no',
          documentUrl: `${backendGatewayUrl}/public/marine-licence/${mockId}/water-framework-directive/download-url`,
          fileName: 'wfd-assessment.docx'
        },
        sites: [],
        marinePlanPolicies: []
      })
    })

    it('should include formatted sites for Dynamics', async () => {
      const { mockHandler } = global

      mockedFindOne.mockResolvedValue({
        _id: mockId,
        projectName: 'Test project',
        status: MARINE_LICENCE_STATUS.SUBMITTED,
        siteDetails: [
          {
            siteName: 'Outer pontoon',
            coordinatesType: 'file',
            fileUploadType: 'shapefile',
            uploadedFile: { filename: 'pontoon.zip' },
            s3Location: {
              s3Bucket: 'mmo-uploads',
              s3Key: 'marine-licences/pontoon.zip',
              checksumSha256: 'abc'
            },
            geoJSON: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'Polygon',
                    coordinates: [
                      [
                        [-3.4, 50.5],
                        [-3.3, 50.5],
                        [-3.3, 50.6],
                        [-3.4, 50.6],
                        [-3.4, 50.5]
                      ]
                    ]
                  }
                }
              ]
            },
            activityDetails: [
              {
                activityType: 'construction',
                activityTypeLabel:
                  'Construction, alteration or improvement of any works',
                activitySubType: 'construction-type-1',
                activitySubTypeLabel: 'Construction of new marine works',
                activities: {
                  selections: ['CON14'],
                  selectionLabels: ['Pontoons or floating walkways']
                },
                activityDuration: { years: 0, months: 6 },
                completionDate: { date: 'no' }
              }
            ]
          }
        ]
      })

      blobService.getPresignedUrl.mockResolvedValue(
        'https://s3.example.com/pontoon.zip'
      )

      await getMarineLicenceGatewayController.handler(
        mockRequest(),
        mockHandler
      )

      const response = mockHandler.response.mock.calls[0][0]
      expect(response.sites).toHaveLength(1)
      expect(response.sites[0].siteName).toBe('Outer pontoon')
      expect(response.sites[0].locationMethod).toBe('File upload')
      expect(response.sites[0].uploadedFile).toEqual({
        filename: 'pontoon.zip',
        fileType: 'Shapefile',
        presignedFileUrl: 'https://s3.example.com/pontoon.zip'
      })
      expect(blobService.getPresignedUrl).toHaveBeenCalledWith(
        'mmo-uploads',
        'marine-licences/pontoon.zip',
        4 * 60 * 60
      )
      expect(response.sites[0].geometry).not.toBeNull()
      expect(response.sites[0].activities[0].activityType).toBe(
        'Construction, alteration or improvement of any works'
      )
      expect(response.sites[0].activities[0].activitySubType).toBe(
        'Construction of new marine works'
      )
      expect(response.sites[0].activities[0].activityDuration).toBe('6 months')
      expect(
        response.sites[0].activities[0].completionDate.hasSpecificDate
      ).toBe('Not needed to be completed by a certain date')
      expect(response.sites[0].activities[0].subActivities).toEqual([
        'Pontoons or floating walkways'
      ])
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
        publicConsultation: null,
        waterFrameworkDirective: {
          nauticalMile: null,
          excludedActivities: null,
          documentUrl: null,
          fileName: null
        },
        sites: [],
        marinePlanPolicies: []
      })
    })

    it('should include marine plan policies with applicant answers for Dynamics', async () => {
      const { mockHandler } = global

      mockedFindOne.mockResolvedValue({
        _id: mockId,
        projectName: 'Pontoon installation',
        status: MARINE_LICENCE_STATUS.SUBMITTED,
        marinePlanPolicies: [
          {
            policyCode: 'SW-CC-1',
            sector: 'Cross-cutting',
            policy: '<p>Proposals that conserve habitats will be supported.</p>'
          },
          {
            policyCode: 'SW-AQ-2',
            sector: 'Aquaculture',
            policy: '<p>Aquaculture policy statement.</p>'
          }
        ],
        marinePlanPolicyResponses: {
          'SW-CC-1':
            'This project will not affect any habitats that provide flood defence services.',
          'SW-AQ-2': '',
          'OLD-1': 'stale answer from a previous policy set'
        }
      })

      await getMarineLicenceGatewayController.handler(
        mockRequest(),
        mockHandler
      )

      expect(mockHandler.response).toHaveBeenCalledWith(
        expect.objectContaining({
          marinePlanPolicies: [
            {
              policyCode: 'SW-CC-1',
              policyInformation:
                '<p>Proposals that conserve habitats will be supported.</p>',
              applicantAnswer:
                'This project will not affect any habitats that provide flood defence services.'
            },
            {
              policyCode: 'SW-AQ-2',
              policyInformation: '<p>Aquaculture policy statement.</p>',
              applicantAnswer: ''
            }
          ]
        })
      )
    })
  })
})
