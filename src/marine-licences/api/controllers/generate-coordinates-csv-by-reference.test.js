import { vi } from 'vitest'
import { generateCoordinatesCsvByReferenceController } from './generate-coordinates-csv-by-reference.js'
import * as siteDetailsModule from '../csv/site-details.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { notAuthorisedMessage } from '../../../shared/constants/errors.js'

describe('GET /public/marine-licence/{applicationReference}/generate-coordinates-csv', () => {
  const applicationReference = 'MLA/2025/10001'

  const mockSite = {
    coordinatesType: 'coordinates',
    coordinatesEntry: 'single',
    coordinateSystem: 'wgs84',
    coordinates: { latitude: '51.5', longitude: '-0.1' },
    circleWidth: '100'
  }

  const mockDoc = {
    siteDetails: [mockSite],
    status: MARINE_LICENCE_STATUS.SUBMITTED
  }

  let mockFindOne
  let mockRequest
  let mockH

  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    mockFindOne = vi.fn().mockResolvedValue(mockDoc)
    const mockCollection = vi.fn().mockReturnValue({ findOne: mockFindOne })

    mockRequest = {
      params: { applicationReference },
      db: { collection: mockCollection }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis()
    }
  })

  it('should throw a 404 when the document is not found', async () => {
    mockFindOne.mockResolvedValue(null)

    await expect(
      generateCoordinatesCsvByReferenceController.handler(mockRequest, mockH)
    ).rejects.toThrow('Marine licence not found')
  })

  it('should return 403 when the marine licence is a draft', async () => {
    mockFindOne.mockResolvedValue({
      ...mockDoc,
      status: MARINE_LICENCE_STATUS.DRAFT
    })

    await expect(
      generateCoordinatesCsvByReferenceController.handler(mockRequest, mockH)
    ).rejects.toThrow(notAuthorisedMessage)
  })

  it('should allow access when the marine licence is active', async () => {
    mockFindOne.mockResolvedValue({
      ...mockDoc,
      status: MARINE_LICENCE_STATUS.ACTIVE
    })

    await generateCoordinatesCsvByReferenceController.handler(
      mockRequest,
      mockH
    )

    expect(mockH.type).toHaveBeenCalledWith('text/csv')
  })

  it('should look up the marine licence by application reference', async () => {
    await generateCoordinatesCsvByReferenceController.handler(
      mockRequest,
      mockH
    )

    expect(mockFindOne).toHaveBeenCalledWith(
      { applicationReference },
      { projection: { siteDetails: 1, status: 1 } }
    )
  })

  it('should call getSiteCoordinates once per site', async () => {
    const getSiteCoordinatesSpy = vi.spyOn(
      siteDetailsModule,
      'getSiteCoordinates'
    )

    await generateCoordinatesCsvByReferenceController.handler(
      mockRequest,
      mockH
    )

    expect(getSiteCoordinatesSpy).toHaveBeenCalledTimes(1)
    expect(getSiteCoordinatesSpy).toHaveBeenCalledWith([mockSite])
  })

  it('should return the stream with csv content-type and content-disposition headers', async () => {
    await generateCoordinatesCsvByReferenceController.handler(
      mockRequest,
      mockH
    )

    expect(mockH.type).toHaveBeenCalledWith('text/csv')
    expect(mockH.header).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="locationForCSV.csv"'
    )
  })
})
