import { vi } from 'vitest'
import { ObjectId } from 'mongodb'

import AdmZip from 'adm-zip'
import { generateCoordinatesCsvPublicController } from './generate-coordinates-csv-public.js'
import * as siteDetailsModule from '../csv/site-details.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { notAuthorisedMessage } from '../../../shared/constants/errors.js'
import {
  mockCircleSite,
  mockMultipleSite
} from '../../../../tests/test.fixture.js'

vi.mock('adm-zip', () => ({
  default: vi.fn(function () {})
}))

describe('GET /public/marine-licence/{id}/generate-coordinates-csv', () => {
  const mockId = new ObjectId().toHexString()

  const mockDoc = {
    siteDetails: [mockCircleSite],
    status: MARINE_LICENCE_STATUS.SUBMITTED
  }

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
      params: { id: mockId },
      db: { collection: mockCollection }
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

  it('should throw a 404 when the document is not found', async () => {
    mockFindOne.mockResolvedValue(null)

    await expect(
      generateCoordinatesCsvPublicController.handler(mockRequest, mockH)
    ).rejects.toThrow('Marine licence not found')
  })

  it('should return 403 when the marine licence is a draft', async () => {
    mockFindOne.mockResolvedValue({
      ...mockDoc,
      status: MARINE_LICENCE_STATUS.DRAFT
    })

    await expect(
      generateCoordinatesCsvPublicController.handler(mockRequest, mockH)
    ).rejects.toThrow(notAuthorisedMessage)
  })

  it('should allow access when the marine licence is active', async () => {
    mockFindOne.mockResolvedValue({
      ...mockDoc,
      status: MARINE_LICENCE_STATUS.ACTIVE
    })

    await generateCoordinatesCsvPublicController.handler(mockRequest, mockH)

    expect(mockH.type).toHaveBeenCalledWith('application/zip')
  })

  it('should look up the marine licence by id', async () => {
    await generateCoordinatesCsvPublicController.handler(mockRequest, mockH)

    expect(mockFindOne).toHaveBeenCalledWith(
      { _id: ObjectId.createFromHexString(mockId) },
      { projection: { siteDetails: 1, status: 1 } }
    )
  })

  it('should call getSiteCoordinates once when there is a single site', async () => {
    const getSiteCoordinatesSpy = vi.spyOn(
      siteDetailsModule,
      'getSiteCoordinates'
    )

    await generateCoordinatesCsvPublicController.handler(mockRequest, mockH)

    expect(getSiteCoordinatesSpy).toHaveBeenCalledTimes(1)
    expect(getSiteCoordinatesSpy).toHaveBeenCalledWith([mockCircleSite])
  })

  it('should add a single zip entry named after the site when there is only one site', async () => {
    await generateCoordinatesCsvPublicController.handler(mockRequest, mockH)

    expect(mockAdmZip.addFile).toHaveBeenCalledTimes(1)
    expect(mockAdmZip.addFile).toHaveBeenCalledWith(
      `${mockCircleSite.siteName}.csv`,
      expect.any(Buffer)
    )
  })

  it('for multiple sites it should add a combined CSV entry plus one entry per site', async () => {
    mockFindOne.mockResolvedValue({
      ...mockDoc,
      siteDetails: [mockMultipleSite, mockCircleSite]
    })
    await generateCoordinatesCsvPublicController.handler(mockRequest, mockH)

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

  it('should return the zip with zip content-type and content-disposition headers', async () => {
    await generateCoordinatesCsvPublicController.handler(mockRequest, mockH)

    expect(mockH.type).toHaveBeenCalledWith('application/zip')
    expect(mockH.header).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="Download CSV.zip"'
    )
  })
})
