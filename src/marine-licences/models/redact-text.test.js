import { redactText, REDACTABLE_FIELDS } from './redact-text.js'
import { mockMarineLicence } from './test-fixtures.js'

describe('redactText', () => {
  const validPayload = {
    id: mockMarineLicence._id.toHexString(),
    fieldKey: 'preferredDates',
    text: 'Redacted by MMO'
  }

  test('should pass with valid data', () => {
    const { error } = redactText.validate(validPayload)
    expect(error).toBeUndefined()
  })

  test.each(REDACTABLE_FIELDS)('should allow the %s field key', (fieldKey) => {
    const { error } = redactText.validate({ ...validPayload, fieldKey })
    expect(error).toBeUndefined()
  })

  test('should error when field key is not redactable', () => {
    const { error } = redactText.validate({
      ...validPayload,
      fieldKey: 'contactId'
    })
    expect(error.message).toContain('REDACTION_FIELD_KEY_INVALID')
  })

  test('should error when field key is missing', () => {
    const { error } = redactText.validate({
      ...validPayload,
      fieldKey: undefined
    })
    expect(error.message).toContain('REDACTION_FIELD_KEY_REQUIRED')
  })

  test('should error when text is missing', () => {
    const { error } = redactText.validate({ ...validPayload, text: undefined })
    expect(error.message).toContain('REDACTION_TEXT_REQUIRED')
  })

  test('should error when text is only whitespace', () => {
    const { error } = redactText.validate({ ...validPayload, text: '   ' })
    expect(error.message).toContain('REDACTION_TEXT_REQUIRED')
  })

  test('should error when id is missing', () => {
    const { error } = redactText.validate({ ...validPayload, id: undefined })
    expect(error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
  })

  test('should error when id is not a valid object id', () => {
    const { error } = redactText.validate({
      ...validPayload,
      id: 'not-an-object-id'
    })
    expect(error.message).toContain('MARINE_LICENCE_ID_REQUIRED')
  })
})
