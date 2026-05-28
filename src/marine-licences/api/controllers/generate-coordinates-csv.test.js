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
      db: { collection: mockCollection }
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
    const mockRow = {
      'Lat Degree': 51,
      'Lat Dec Min': 30,
      'Long Degree': -1,
      'Long Dec Min': 15,
      objectid: 1
    }
    vi.spyOn(csvOutputModule, 'csvOutput').mockReturnValue([mockRow])

    await generateCoordinatesCsvController.handler(mockRequest, mockH)

    const csvStream = mockH.response.mock.calls[0][0]
    const writeSpy = vi.spyOn(csvStream, 'write')

    mockCursor.emit('data', { siteDetails: [] })

    expect(mockRequest.db.collection).toHaveBeenCalledWith('marine-licences')
    expect(
      mockRequest.db.collection('marine-licences').find
    ).toHaveBeenCalledWith(expect.objectContaining({ _id: expect.anything() }))

    expect(writeSpy).toHaveBeenCalledWith(mockRow)
  })
})
