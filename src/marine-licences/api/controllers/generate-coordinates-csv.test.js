import { vi } from 'vitest'
import AdmZip from 'adm-zip'
import { generateCoordinatesCsvController } from './generate-coordinates-csv.js'
import * as siteDetailsModule from '../csv/site-details.js'
import * as csvOutputModule from '../csv/csv-output.js'
import {
  mockCircleSite,
  mockMultipleSite
} from '../../../../tests/test.fixture.js'

vi.mock('adm-zip', () => ({
  default: vi.fn(function () {})
}))

describe('GET /marine-licence/{id}/generate-coordinates-csv', () => {
  const mockId = 'a'.repeat(24)

  const mockDoc = { siteDetails: [mockCircleSite] }

  let mockFindOne
  let mockRequest
  let mockH
  let mockAdmZip

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

    mockAdmZip = {
      addFile: vi.fn(),
      toBuffer: vi.fn().mockReturnValue(Buffer.from('zip-bytes'))
    }
    AdmZip.mockImplementation(function () {
      return mockAdmZip
    })
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

  it('should call getSiteCoordinates once when there is a single site', async () => {
    const getSiteCoordinatesSpy = vi.spyOn(
      siteDetailsModule,
      'getSiteCoordinates'
    )

    await generateCoordinatesCsvController.handler(mockRequest, mockH)

    expect(getSiteCoordinatesSpy).toHaveBeenCalledTimes(1)
    expect(getSiteCoordinatesSpy).toHaveBeenCalledWith([mockCircleSite])
  })

  it('should call csvOutput once when there is a single site', async () => {
    const csvOutputSpy = vi.spyOn(csvOutputModule, 'csvOutput')

    await generateCoordinatesCsvController.handler(mockRequest, mockH)

    expect(csvOutputSpy).toHaveBeenCalledTimes(1)
  })

  it('should add a single zip entry named after the site when there is only one site', async () => {
    await generateCoordinatesCsvController.handler(mockRequest, mockH)

    expect(mockAdmZip.addFile).toHaveBeenCalledTimes(1)
    expect(mockAdmZip.addFile).toHaveBeenCalledWith(
      `${mockCircleSite.siteName}.csv`,
      expect.any(Buffer)
    )
  })

  it('for mutliple sites it should add a combined CSV entry plus one entry per site', async () => {
    mockFindOne.mockResolvedValue({
      siteDetails: [mockMultipleSite, mockCircleSite]
    })

    await generateCoordinatesCsvController.handler(mockRequest, mockH)

    expect(mockAdmZip.addFile).toHaveBeenCalledTimes(3)
    expect(mockAdmZip.addFile).toHaveBeenCalledWith(
      'All_Sites.csv',
      expect.any(Buffer)
    )
    expect(mockAdmZip.addFile).toHaveBeenCalledWith(
      `${mockMultipleSite.siteName}.csv`,
      expect.any(Buffer)
    )
    expect(mockAdmZip.addFile).toHaveBeenCalledWith(
      `${mockCircleSite.siteName}.csv`,
      expect.any(Buffer)
    )
  })

  it('should throw when processing a site fails', async () => {
    vi.spyOn(siteDetailsModule, 'getSiteCoordinates').mockImplementation(() => {
      throw new Error('processing failed')
    })

    await expect(
      generateCoordinatesCsvController.handler(mockRequest, mockH)
    ).rejects.toThrow('processing failed')
  })

  it('should return the zip with zip content-type and content-disposition headers', async () => {
    await generateCoordinatesCsvController.handler(mockRequest, mockH)

    expect(mockH.type).toHaveBeenCalledWith('application/zip')
    expect(mockH.header).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="Download CSV.zip"'
    )
  })
})
