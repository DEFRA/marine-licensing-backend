import {
  buildCoordinatesCsvPathById,
  buildCoordinatesCsvUrlById
} from './coordinates-csv.js'

describe('coordinates-csv constants', () => {
  it('builds a path with the marine licence id', () => {
    expect(buildCoordinatesCsvPathById('507f1f77bcf86cd799439011')).toBe(
      '/public/marine-licence/507f1f77bcf86cd799439011/generate-coordinates-csv'
    )
  })

  it('builds an absolute coordinates CSV URL', () => {
    expect(
      buildCoordinatesCsvUrlById(
        'https://api.example.com',
        '507f1f77bcf86cd799439011'
      )
    ).toBe(
      'https://api.example.com/public/marine-licence/507f1f77bcf86cd799439011/generate-coordinates-csv'
    )
  })
})
