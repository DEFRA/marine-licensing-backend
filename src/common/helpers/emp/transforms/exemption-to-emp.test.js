import { describe, expect, test } from 'vitest'
import { transformExemptionToEmpRequest } from './exemption-to-emp.js'
import { testExemptions } from './test-exemptions.fixture.js'

describe('transformExemptionToEmpRequest', () => {
  test.each(testExemptions)(
    'transforms exemption: $dbRecord.projectName',
    ({ dbRecord, expected }) => {
      const result = transformExemptionToEmpRequest({
        exemption: dbRecord,
        whoExemptionIsFor: 'Test Applicant'
      })
      expect(result).toEqual(expected)
    }
  )
})
