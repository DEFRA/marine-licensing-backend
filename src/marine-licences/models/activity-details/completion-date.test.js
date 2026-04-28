import joi from 'joi'
import { completionDateSchema } from './completion-date.js'

const schema = joi.object({ completionDate: completionDateSchema })

describe('completionDate', () => {
  test('should pass with correct values', () => {
    const { error } = schema.validate({
      completionDate: { date: 'yes', reason: 'Test reason' }
    })
    expect(error).toBeUndefined()
  })

  test('should fail when reason not provided or blank', () => {
    const { error: missingError } = schema.validate({
      completionDate: { date: 'yes' }
    })
    expect(missingError.message).toContain('COMPLETION_DATE_REASON_REQUIRED')

    const { error: blankError } = schema.validate({
      completionDate: { date: 'yes', reason: '' }
    })
    expect(blankError.message).toContain('COMPLETION_DATE_REASON_REQUIRED')
  })

  test('should fail when reason length exceeds limit value', () => {
    const longString = 't'.repeat(10000 + 1)
    const { error } = schema.validate({
      completionDate: { date: 'yes', reason: longString }
    })
    expect(error.message).toContain('COMPLETION_DATE_REASON_MAX_LENGTH')
  })
})
