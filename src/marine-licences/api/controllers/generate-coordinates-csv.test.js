import { EventEmitter } from 'events'
import { vi } from 'vitest'
import { generateCoordinatesCsvController } from './generate-coordinates-csv.js'
import * as siteDetailsModule from '../csv/site-details.js'
import * as csvOutputModule from '../csv/csv-output.js'

describe('GET /marine-licence/{id}/generate-coordinates-csv', () => {
  const mockId = 'a'.repeat(24)

  let mockCursor
  let mockRequest
  let mockH

  beforeEach(() => {
    mockCursor = new EventEmitter()

    const mockStream = vi.fn().mockReturnValue(mockCursor)
    const mockFind = vi.fn().mockReturnValue({ stream: mockStream })
    const mockCollection = vi.fn().mockReturnValue({ find: mockFind })

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

  it('should destroy the csv stream when the cursor emits an error', async () => {
    await generateCoordinatesCsvController.handler(mockRequest, mockH)

    const csvStream = mockH.response.mock.calls[0][0]
    const destroySpy = vi.spyOn(csvStream, 'destroy')
    csvStream.on('error', () => {})

    const err = new Error('cursor error')
    mockCursor.emit('error', err)

    expect(destroySpy).toHaveBeenCalledWith(err)
  })

  it('should end the csv stream when the cursor ends', async () => {
    await generateCoordinatesCsvController.handler(mockRequest, mockH)

    const csvStream = mockH.response.mock.calls[0][0]
    const endSpy = vi.spyOn(csvStream, 'end')

    mockCursor.emit('end')

    expect(endSpy).toHaveBeenCalled()
  })

  it('should call getSiteCoordinates with doc.siteDetails when the cursor emits data', async () => {
    const getSiteCoordinatesSpy = vi.spyOn(
      siteDetailsModule,
      'getSiteCoordinates'
    )
    await generateCoordinatesCsvController.handler(mockRequest, mockH)

    const mockDoc = {
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'single',
          coordinateSystem: 'wgs84',
          coordinates: { latitude: '51.5', longitude: '-0.1' },
          circleWidth: '100'
        }
      ]
    }
    mockCursor.emit('data', mockDoc)

    expect(getSiteCoordinatesSpy).toHaveBeenCalledWith(mockDoc.siteDetails)
  })

  it('should write each row returned by csvOutput into the csv stream', async () => {
    const mockRow = [51, 30, 0, 15, 0]
    vi.spyOn(csvOutputModule, 'csvOutput').mockReturnValue([mockRow])

    await generateCoordinatesCsvController.handler(mockRequest, mockH)

    const csvStream = mockH.response.mock.calls[0][0]
    const writeSpy = vi.spyOn(csvStream, 'write')

    mockCursor.emit('data', { siteDetails: [] })

    expect(writeSpy).toHaveBeenCalledWith(mockRow)
  })

  it('should log an error and destroy the stream when processing fails', async () => {
    vi.spyOn(siteDetailsModule, 'getSiteCoordinates').mockImplementation(() => {
      throw new Error('processing failed')
    })

    await generateCoordinatesCsvController.handler(mockRequest, mockH)

    const csvStream = mockH.response.mock.calls[0][0]
    csvStream.on('error', () => {})

    mockCursor.emit('data', { siteDetails: [] })

    expect(mockRequest.logger.error).toHaveBeenCalled()
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
