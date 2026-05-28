import { EventEmitter } from 'events'
import { vi } from 'vitest'
import { generateCoordinatesCsvController } from './generate-coordinates-csv.js'

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

  it('should write each doc from the cursor into the csv stream', async () => {
    await generateCoordinatesCsvController.handler(mockRequest, mockH)

    const csvStream = mockH.response.mock.calls[0][0]
    const writeSpy = vi.spyOn(csvStream, 'write')

    const mockDoc = {
      'Lat Degree': 51,
      'Lat Dec Min': 30,
      'Long Degree': -1,
      'Long Dec Min': 15,
      objectid: 1
    }
    mockCursor.emit('data', mockDoc)

    expect(mockRequest.db.collection).toHaveBeenCalledWith('marine-licences')
    expect(
      mockRequest.db.collection('marine-licences').find
    ).toHaveBeenCalledWith(expect.objectContaining({ _id: expect.anything() }))

    expect(writeSpy).toHaveBeenCalledWith(mockDoc)
  })
})
