import { describe, expect, test } from 'vitest'
import { transformExemptionToEmpRequest } from './exemption-to-emp.js'
import { testExemptions } from './test-exemptions.fixture.js'
import { EXEMPTION_STATUS } from '../../../../../exemptions/constants/exemption.js'

describe('transformExemptionToEmpRequest', () => {
  test.each(testExemptions)(
    'transforms exemption: $dbRecord.projectName',
    ({ dbRecord, expectedFeatures }) => {
      const result = transformExemptionToEmpRequest({
        exemption: dbRecord
      })
      expect(result).toEqual(expectedFeatures)
    }
  )

  describe('status', () => {
    const [{ dbRecord }] = testExemptions

    const statusSentFor = (status) => {
      const [feature] = transformExemptionToEmpRequest({
        exemption: { ...dbRecord, status }
      })
      return feature.attributes.Status
    }

    test.each([
      [EXEMPTION_STATUS.SCHEDULED, 'Scheduled'],
      [EXEMPTION_STATUS.ACTIVE, 'Active'],
      [EXEMPTION_STATUS.EXPIRED, 'Expired'],
      [EXEMPTION_STATUS.WITHDRAWN, 'Withdrawn']
    ])('sends a %s exemption to EMP as %s', (status, expected) => {
      expect(statusSentFor(status)).toBe(expected)
    })

    test('sends no status rather than defaulting when the status is unmapped', () => {
      expect(statusSentFor('NOT_A_STATUS')).toBeUndefined()
    })
  })
})
