import {
  buildCopiedMarineLicence,
  FIELDS_TO_DROP_ON_COPY
} from './build-copied-marine-licence.js'
import {
  createCompleteMarineLicence,
  mockCredentials,
  mockRejectedMarineLicenceFields
} from '../../../../tests/test.fixture.js'

describe('buildCopiedMarineLicence', () => {
  const audit = {
    contactId: mockCredentials.contactId,
    createdBy: mockCredentials.contactId,
    createdAt: new Date('2026-08-06T12:00:00Z'),
    updatedBy: mockCredentials.contactId,
    updatedAt: new Date('2026-08-06T12:00:00Z')
  }

  it('deletes the fee estimate acceptance without altering the rest of the fields', () => {
    const source = createCompleteMarineLicence(mockRejectedMarineLicenceFields)
    const result = buildCopiedMarineLicence(source, audit)

    expect(result.feeEstimate).not.toHaveProperty('accept')
    expect(result.feeEstimate).toEqual({
      termsAndConditions: true,
      feeBand: '2A'
    })
  })

  it('does not add feeEstimate when the source has none', () => {
    const source = createCompleteMarineLicence(mockRejectedMarineLicenceFields)
    delete source.feeEstimate

    const result = buildCopiedMarineLicence(source, audit)

    expect(result).not.toHaveProperty('feeEstimate')
  })

  it('deletes the fields that are excluded in the copy', () => {
    const source = createCompleteMarineLicence(mockRejectedMarineLicenceFields)
    const result = buildCopiedMarineLicence(source, audit)

    FIELDS_TO_DROP_ON_COPY.forEach((property) => {
      expect(result).not.toHaveProperty(property)
    })

    Object.entries(audit).forEach(([property, value]) => {
      expect(result).toHaveProperty(property)
      expect(result[property]).toEqual(value)
    })

    expect(result).not.toHaveProperty('applicationReference')
  })
})
