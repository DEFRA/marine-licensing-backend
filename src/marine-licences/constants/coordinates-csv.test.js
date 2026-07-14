import {
  buildCoordinatesCsvPathByReference,
  buildCoordinatesCsvUrlByReference
} from './coordinates-csv.js'

describe('coordinates-csv constants', () => {
  it('builds a path with an encoded application reference', () => {
    expect(buildCoordinatesCsvPathByReference('MLA/2025/10001')).toBe(
      '/public/marine-licence/MLA%2F2025%2F10001/generate-coordinates-csv'
    )
  })

  it('builds an absolute coordinates CSV URL', () => {
    expect(
      buildCoordinatesCsvUrlByReference(
        'https://api.example.com',
        'MLA/2025/10001'
      )
    ).toBe(
      'https://api.example.com/public/marine-licence/MLA%2F2025%2F10001/generate-coordinates-csv'
    )
  })
})
