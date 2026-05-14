import { describe, expect, test } from 'vitest'
import { sanitiseSummaryText } from './sanitise-summary-text.js'

// CONTRACT: sanitise-html canary — MUST stay in sync with the equivalent test
// in marine-licensing-frontend (src/server/journey/self-service/services/
// sanitise.test.js). If you change this canary, change BOTH repos at the same
// time. Verified empirically against sanitize-html ^2.17.3.
const CANARY_INPUT =
  '<p>Hello <a href="https://example.gov.uk/x" target="_blank" rel="noopener">link</a> ' +
  '<b>bold</b> <u>under</u> <strong>strong</strong><br><ul><li>one</li></ul>' +
  '<ol type="a"><li>alpha</li></ol>' +
  '<script>alert(1)</script><img src="x" onerror="alert(1)">' +
  '<a href="javascript:alert(1)">bad</a>' +
  '<style>body{}</style><iframe src="https://evil"></iframe>'

const CANARY_OUTPUT =
  '<p>Hello <a href="https://example.gov.uk/x" target="_blank" rel="noopener">link</a> ' +
  '<b>bold</b> <u>under</u> <strong>strong</strong><br /></p>' +
  '<ul><li>one</li></ul>' +
  '<ol type="a"><li>alpha</li></ol>' +
  '<a>bad</a>'

describe('sanitiseSummaryText', () => {
  test('contract: canary round-trips to expected output', () => {
    expect(sanitiseSummaryText(CANARY_INPUT)).toBe(CANARY_OUTPUT)
  })

  test('returns falsy values unchanged', () => {
    expect(sanitiseSummaryText(null)).toBeNull()
    expect(sanitiseSummaryText(undefined)).toBeUndefined()
    expect(sanitiseSummaryText('')).toBe('')
  })

  test('idempotent — running on already-sanitised output produces no change', () => {
    const once = sanitiseSummaryText(CANARY_INPUT)
    const twice = sanitiseSummaryText(once)
    expect(twice).toBe(once)
  })
})
