import { createActivityDatesController } from './update-activity-dates.js'
import { ObjectId } from 'mongodb'

describe('PATCH /exemptions/activity-dates', () => {
  const payloadValidator =
    createActivityDatesController.options.validate.payload

  it('should fail start date is missing', () => {
    const result = payloadValidator.validate({})
    expect(result.error.message).toContain('CUSTOM_START_DATE_MISSING')
  })

  it('should fail if end date is missing', () => {
    const result = payloadValidator.validate({
      start: new Date('2027-01-01')
    })
    expect(result.error.message).toContain('CUSTOM_END_DATE_MISSING')
  })

  it('should fail if start date is invalid', () => {
    const result = payloadValidator.validate({
      start: 'invalid-date',
      end: new Date('2027-12-31')
    })
    expect(result.error.message).toContain('CUSTOM_START_DATE_INVALID')
  })

  it('should fail if end date is invalid', () => {
    const result = payloadValidator.validate({
      start: new Date('2027-01-01'),
      end: 'invalid-date'
    })
    expect(result.error.message).toContain('CUSTOM_END_DATE_INVALID')
  })

  it('should fail if end date is before start date', () => {
    const result = payloadValidator.validate({
      start: new Date('2027-12-31'),
      end: new Date('2027-01-01')
    })
    expect(result.error.message).toContain('CUSTOM_END_DATE_BEFORE_START_DATE')
  })

  it('should fail if exemption id is missing', () => {
    const result = payloadValidator.validate({
      start: new Date('2027-01-01'),
      end: new Date('2027-12-31')
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
            start: new Date('2027-01-01'),
            end: new Date('2027-12-31'),
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
            start: new Date('2027-01-01'),
            end: new Date('2027-12-31'),
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
          start: new Date('2027-01-01'),
          end: new Date('2027-12-31'),
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
