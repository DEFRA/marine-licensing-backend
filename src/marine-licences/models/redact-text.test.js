import {
  redactText,
  REDACTABLE_FIELDS,
  WITHHOLD_LOCATION_FIELD,
  buildFieldPath
} from './redact-text.js'
import { mockMarineLicence } from './test-fixtures.js'

describe('redactText', () => {
  const validPayload = {
    id: mockMarineLicence._id.toHexString(),
    fieldKey: 'preferredDates',
    text: 'Redacted by MMO'
  }

  const withIndexes = (fieldKey) => ({
    ...validPayload,
    fieldKey,
    ...(fieldKey.startsWith('siteDetails') && { siteIndex: 0 }),
    ...(fieldKey.includes('activityDetails') && { activityIndex: 1 }),
    ...(fieldKey.startsWith('marinePlanPolicyResponses') && {
      policyCode: 'E-AGG-3'
    }),
    ...(fieldKey === WITHHOLD_LOCATION_FIELD && { withhold: true, text: '' })
  })

  test('should pass with valid data', () => {
    const { error } = redactText.validate(validPayload)
    expect(error).toBeUndefined()
  })

  test.each(REDACTABLE_FIELDS)('should allow the %s field key', (fieldKey) => {
    const { error } = redactText.validate(withIndexes(fieldKey))
    expect(error).toBeUndefined()
  })

  describe('withholding a location', () => {
    const withholdPayload = {
      ...validPayload,
      fieldKey: WITHHOLD_LOCATION_FIELD,
      siteIndex: 0,
      text: '',
      withhold: true
    }

    test('should allow blank text', () => {
      const { error } = redactText.validate(withholdPayload)
      expect(error).toBeUndefined()
    })

    test('should allow text to be omitted', () => {
      const { error } = redactText.validate({
        ...withholdPayload,
        text: undefined
      })
      expect(error).toBeUndefined()
    })

    test('should allow withhold to be false', () => {
      const { error } = redactText.validate({
        ...withholdPayload,
        withhold: false
      })
      expect(error).toBeUndefined()
    })

    test('should error when withhold is not a boolean', () => {
      const { error } = redactText.validate({
        ...withholdPayload,
        withhold: 'yes please'
      })
      expect(error.message).toContain('WITHHOLD_INVALID')
    })
  })

  describe('removing a redaction', () => {
    test('should allow text to be omitted', () => {
      const { error } = redactText.validate({
        ...validPayload,
        text: undefined,
        remove: true
      })
      expect(error).toBeUndefined()
    })

    test('should allow a withheld location to be removed with no flag', () => {
      const { error } = redactText.validate({
        ...validPayload,
        fieldKey: WITHHOLD_LOCATION_FIELD,
        siteIndex: 0,
        text: undefined,
        remove: true
      })
      expect(error).toBeUndefined()
    })

    test('should not require text whenever remove is present', () => {
      const { error } = redactText.validate({
        ...validPayload,
        text: undefined,
        remove: false
      })
      expect(error).toBeUndefined()
    })

    test('should allow remove alongside withhold', () => {
      const { error } = redactText.validate({
        ...validPayload,
        fieldKey: WITHHOLD_LOCATION_FIELD,
        siteIndex: 0,
        text: undefined,
        withhold: true,
        remove: true
      })
      expect(error).toBeUndefined()
    })
  })

  test('should error when text is blank for a normal field', () => {
    const { error } = redactText.validate({ ...validPayload, text: '' })
    expect(error.message).toContain('REDACTION_TEXT_REQUIRED')
  })

  test('should error when a site index is not a number', () => {
    const { error } = redactText.validate({
      ...validPayload,
      fieldKey: 'siteDetails.siteName',
      siteIndex: '0.siteName'
    })
    expect(error.message).toContain('REDACTION_INDEX_INVALID')
  })

  describe('buildFieldPath', () => {
    test.each([
      ['projectName', {}, 'projectName'],
      ['siteDetails.siteName', { siteIndex: 3 }, 'siteDetails.3.siteName'],
      [
        WITHHOLD_LOCATION_FIELD,
        { siteIndex: 0 },
        'siteDetails.0.withholdLocation'
      ],
      [
        'siteDetails.activityDetails.activityDescription',
        { siteIndex: 2, activityIndex: 1 },
        'siteDetails.2.activityDetails.1.activityDescription'
      ],
      [
        'marinePlanPolicyResponses',
        { policyCode: 'E-AGG-3' },
        'marinePlanPolicyResponses.E-AGG-3'
      ]
    ])('should build %s into %s', (fieldKey, params, expected) => {
      expect(buildFieldPath(fieldKey, params)).toBe(expected)
    })
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
