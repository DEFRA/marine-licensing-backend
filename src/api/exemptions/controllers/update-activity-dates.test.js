import { createActivityDatesController } from './update-activity-dates.js'
import { ObjectId } from 'mongodb'

describe('PATCH /exemptions/activity-dates', () => {
  const payloadValidator =
    createActivityDatesController.options.validate.payload

  it('should fail start date is missing', () => {
    const result = payloadValidator.validate({})
    expect(result.error.message).toContain('ACTIVITY_START_DATE_REQUIRED')
  })

  it('should fail if end date fields are missing', () => {
    const result = payloadValidator.validate({
      start: {
        day: 1,
        month: 1,
        year: 2027
      }
    })
    expect(result.error.message).toContain('ACTIVITY_END_DATE_REQUIRED')
  })

  it('should fail if any of the dd/mm/yyyy fields are missing', () => {
    const result = payloadValidator.validate({
      start: {
        day: 1,
        month: 1
      },
      end: {
        day: 31,
        month: 12,
        year: 2027
      }
    })
    expect(result.error.message).toContain('ACTIVITY_START_DATE_REQUIRED')
  })

  it('should fail if exemption id is missing', () => {
    const result = payloadValidator.validate({
      start: {
        day: 1,
        month: 1,
        year: 2027
      },
      end: {
        day: 31,
        month: 12,
        year: 2027
      }
    })
    expect(result.error.message).toContain('EXEMPTION_ID_REQUIRED')
  })

  it('should fail if exemption is not found', async () => {
    const { mockMongo, mockHandler } = global

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        updateOne: jest.fn().mockResolvedValueOnce({ matchedCount: 0 })
      }
    })

    await expect(
      createActivityDatesController.handler(
        {
          db: mockMongo,
          payload: {
            start: {
              day: 1,
              month: 1,
              year: 2027
            },
            end: {
              day: 31,
              month: 12,
              year: 2027
            },
            id: new ObjectId().toHexString()
          }
        },
        mockHandler
      )
    ).rejects.toThrow('Exemption not found')
  })

  it('should fail if there is a database error', async () => {
    const { mockMongo, mockHandler } = global

    const mockError = 'Database failed'

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        updateOne: jest.fn().mockRejectedValueOnce(new Error(mockError))
      }
    })

    await expect(
      createActivityDatesController.handler(
        {
          db: mockMongo,
          payload: {
            start: {
              day: 1,
              month: 1,
              year: 2027
            },
            end: {
              day: 31,
              month: 12,
              year: 2027
            },
            id: new ObjectId().toHexString()
          }
        },
        mockHandler
      )
    ).rejects.toThrow(`Error creating activity dates: ${mockError}`)
  })

  it('should update exemption with activity dates', async () => {
    const { mockMongo, mockHandler } = global

    jest.spyOn(mockMongo, 'collection').mockImplementation(() => {
      return {
        updateOne: jest.fn().mockResolvedValueOnce({})
      }
    })

    await createActivityDatesController.handler(
      {
        db: mockMongo,
        payload: {
          start: {
            day: 1,
            month: 1,
            year: 2027
          },
          end: {
            day: 31,
            month: 12,
            year: 2027
          },
          id: new ObjectId().toHexString()
        }
      },
      mockHandler
    )

    expect(mockHandler.response).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'success'
      })
    )
  })
})
