import { vi } from 'vitest'
import { generateCoordinatesCsvController } from './generate-coordinates-csv.js'
import * as siteDetailsModule from '../csv/site-details.js'
import * as csvOutputModule from '../csv/csv-output.js'

describe('GET /marine-licence/{id}/generate-coordinates-csv', () => {
  const mockId = 'a'.repeat(24)

  const mockSite = {
    coordinatesType: 'coordinates',
    coordinatesEntry: 'single',
    coordinateSystem: 'wgs84',
    coordinates: { latitude: '51.5', longitude: '-0.1' },
    circleWidth: '100'
  }

  const mockDoc = { siteDetails: [mockSite] }

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
      auth: { artifacts: { decoded: { tid: 'tenant-id' } } },
      params: { id: mockId },
      db: { collection: mockCollection },
      logger: { error: vi.fn() }
    }

    mockH = {
      response: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis()
    }
  })

  it('should return 403 when user is not an Entra ID user', async () => {
    mockRequest.auth.artifacts.decoded = {}

    await expect(
      generateCoordinatesCsvController.handler(mockRequest, mockH)
    ).rejects.toThrow('Not authorised to view CSV data')
  })

  it('should throw a 404 when the document is not found', async () => {
    mockFindOne.mockResolvedValue(null)

    await expect(
      generateCoordinatesCsvController.handler(mockRequest, mockH)
    ).rejects.toThrow('Marine licence not found')
  })

  it('should call getSiteCoordinates once per site', async () => {
    const getSiteCoordinatesSpy = vi.spyOn(
      siteDetailsModule,
      'getSiteCoordinates'
    )

    await generateCoordinatesCsvController.handler(mockRequest, mockH)

    expect(getSiteCoordinatesSpy).toHaveBeenCalledTimes(1)
    expect(getSiteCoordinatesSpy).toHaveBeenCalledWith([mockSite])
  })

  it('should call csvOutput once per site', async () => {
    const csvOutputSpy = vi.spyOn(csvOutputModule, 'csvOutput')

    await generateCoordinatesCsvController.handler(mockRequest, mockH)

    expect(csvOutputSpy).toHaveBeenCalledTimes(1)
  })

  it('should throw when processing a site fails', async () => {
    vi.spyOn(siteDetailsModule, 'getSiteCoordinates').mockImplementation(() => {
      throw new Error('processing failed')
    })

    await expect(
      generateCoordinatesCsvController.handler(mockRequest, mockH)
    ).rejects.toThrow('processing failed')
  })

  it('should return the stream with csv content-type and content-disposition headers', async () => {
    await generateCoordinatesCsvController.handler(mockRequest, mockH)

    expect(mockH.type).toHaveBeenCalledWith('text/csv')
    expect(mockH.header).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="locationForCSV.csv"'
    )
  })
})
