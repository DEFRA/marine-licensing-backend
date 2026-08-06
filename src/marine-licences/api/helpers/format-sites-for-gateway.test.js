import { describe, expect, test, vi, afterEach } from 'vitest'
import {
  buildSiteGeometry,
  formatActivityDuration,
  formatActivityMonthsForGateway,
  formatCompletionDateForGateway,
  formatSitesForGateway,
  SITE_FILE_PRESIGNED_URL_EXPIRES_IN_SECONDS
} from './format-sites-for-gateway.js'
import * as siteDetailsModule from '../csv/site-details.js'
import { blobService } from '../../../shared/services/data-service/blob-service.js'

vi.mock('../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    getPresignedUrl: vi.fn()
  }
}))

describe('formatActivityDuration', () => {
  test('returns months only when years is zero', () => {
    expect(formatActivityDuration({ years: 0, months: 6 })).toBe('6 months')
  })

  test('returns singular month', () => {
    expect(formatActivityDuration({ years: 0, months: 1 })).toBe('1 month')
  })

  test('returns years only when months is zero', () => {
    expect(formatActivityDuration({ years: 2, months: 0 })).toBe('2 years')
  })

  test('returns singular year', () => {
    expect(formatActivityDuration({ years: 1, months: 0 })).toBe('1 year')
  })

  test('returns years and months together', () => {
    expect(formatActivityDuration({ years: 1, months: 3 })).toBe(
      '1 year 3 months'
    )
  })

  test('returns null when empty', () => {
    expect(formatActivityDuration({})).toBeNull()
  })

  test('returns null when both years and months are zero', () => {
    expect(formatActivityDuration({ years: 0, months: 0 })).toBeNull()
  })

  test('returns null when values are not finite', () => {
    expect(formatActivityDuration({ years: 'x', months: 1 })).toBeNull()
    expect(formatActivityDuration({ years: 1, months: Number.NaN })).toBeNull()
  })

  test('treats missing years as zero when months set', () => {
    expect(formatActivityDuration({ months: 3 })).toBe('3 months')
  })

  test('treats missing months as zero when years set', () => {
    expect(formatActivityDuration({ years: 2 })).toBe('2 years')
  })
})

describe('formatCompletionDateForGateway', () => {
  test('uses not-needed wording when date is no', () => {
    expect(formatCompletionDateForGateway({ date: 'no' })).toEqual({
      hasSpecificDate: 'Not needed to be completed by a certain date',
      reason: null
    })
  })

  test('returns Yes and reason when date is yes', () => {
    expect(
      formatCompletionDateForGateway({
        date: 'yes',
        reason: 'Before nesting season'
      })
    ).toEqual({
      hasSpecificDate: 'Yes',
      reason: 'Before nesting season'
    })
  })

  test('returns null fields when date is missing', () => {
    expect(formatCompletionDateForGateway({})).toEqual({
      hasSpecificDate: null,
      reason: null
    })
  })

  test('returns null reason when yes but reason omitted', () => {
    expect(formatCompletionDateForGateway({ date: 'yes' })).toEqual({
      hasSpecificDate: 'Yes',
      reason: null
    })
  })
})

describe('formatActivityMonthsForGateway', () => {
  test('returns Yes with details when months is yes', () => {
    expect(
      formatActivityMonthsForGateway({
        months: 'yes',
        details: 'Mar–Sep'
      })
    ).toEqual({ applicable: 'Yes', details: 'Mar–Sep' })
  })

  test('returns No with null details when months is no', () => {
    expect(formatActivityMonthsForGateway({ months: 'no' })).toEqual({
      applicable: 'No',
      details: null
    })
  })

  test('returns nulls when months missing', () => {
    expect(formatActivityMonthsForGateway({})).toEqual({
      applicable: null,
      details: null
    })
  })

  test('returns null applicable for unknown months value', () => {
    expect(formatActivityMonthsForGateway({ months: 'maybe' })).toEqual({
      applicable: null,
      details: null
    })
  })

  test('returns null details when yes but details missing', () => {
    expect(formatActivityMonthsForGateway({ months: 'yes' })).toEqual({
      applicable: 'Yes',
      details: null
    })
  })
})

describe('formatSitesForGateway', () => {
  test('uses FE-snapshotted labels and mints presignedFileUrl for file sites', async () => {
    const getPresignedUrl = vi
      .fn()
      .mockResolvedValue('https://s3.example.com/presigned-site.zip')

    const result = await formatSitesForGateway(
      [
        {
          siteName: 'Outer pontoon',
          coordinatesType: 'file',
          fileUploadType: 'shapefile',
          uploadedFile: { filename: 'site.zip' },
          s3Location: {
            s3Bucket: 'mmo-uploads',
            s3Key: 'marine-licences/site.zip',
            checksumSha256: 'abc'
          },
          geoJSON: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'Polygon',
                  coordinates: [
                    [
                      [-3.4, 50.5],
                      [-3.3, 50.5],
                      [-3.3, 50.6],
                      [-3.4, 50.6],
                      [-3.4, 50.5]
                    ]
                  ]
                }
              }
            ]
          },
          activityDetails: [
            {
              activityType: 'construction',
              activityTypeLabel:
                'Construction, alteration or improvement of any works',
              activitySubType: 'construction-type-1',
              activitySubTypeLabel: 'Construction of new marine works',
              activities: {
                selections: ['CON14', 'CON12'],
                selectionLabels: [
                  'Pontoons or floating walkways',
                  'Slipway or boat ramp'
                ]
              },
              activityDescription: 'Install pontoon',
              activityDuration: { years: 0, months: 6 },
              activityMonths: { months: 'yes', details: 'Mar–Sep' },
              completionDate: { date: 'no' },
              workingHours: '08:00-17:00'
            }
          ]
        }
      ],
      { getPresignedUrl }
    )

    expect(getPresignedUrl).toHaveBeenCalledWith(
      'mmo-uploads',
      'marine-licences/site.zip',
      SITE_FILE_PRESIGNED_URL_EXPIRES_IN_SECONDS
    )
    expect(result).toHaveLength(1)
    expect(result[0].siteIndex).toBe(0)
    expect(result[0].locationMethod).toBe('File upload')
    expect(result[0].uploadedFile).toEqual({
      filename: 'site.zip',
      fileType: 'Shapefile',
      presignedFileUrl: 'https://s3.example.com/presigned-site.zip'
    })
    expect(result[0].geometry.type).toBe('FeatureCollection')
    expect(result[0].activities[0]).toMatchObject({
      activityIndex: 0,
      activityType: 'Construction, alteration or improvement of any works',
      activitySubType: 'Construction of new marine works',
      subActivities: ['Pontoons or floating walkways', 'Slipway or boat ramp'],
      activityDuration: '6 months',
      completionDate: {
        hasSpecificDate: 'Not needed to be completed by a certain date',
        reason: null
      },
      activityMonths: {
        applicable: 'Yes',
        details: 'Mar–Sep'
      }
    })
  })

  test('returns null presignedFileUrl when minting fails and logs the error', async () => {
    const getPresignedUrl = vi
      .fn()
      .mockRejectedValue(new Error('S3 unavailable'))

    const result = await formatSitesForGateway(
      [
        {
          coordinatesType: 'file',
          fileUploadType: 'kml',
          uploadedFile: { filename: 'site.kml' },
          s3Location: {
            s3Bucket: 'mmo-uploads',
            s3Key: 'marine-licences/site.kml'
          },
          activityDetails: []
        }
      ],
      { getPresignedUrl }
    )

    expect(result[0].uploadedFile).toEqual({
      filename: 'site.kml',
      fileType: 'KML',
      presignedFileUrl: null
    })
  })

  test('uses unknown filename in error path when uploadedFile is missing', async () => {
    const getPresignedUrl = vi
      .fn()
      .mockRejectedValue(new Error('S3 unavailable'))

    const result = await formatSitesForGateway(
      [
        {
          coordinatesType: 'file',
          s3Location: {
            s3Bucket: 'mmo-uploads',
            s3Key: 'marine-licences/missing-name'
          },
          activityDetails: []
        }
      ],
      { getPresignedUrl }
    )

    expect(result[0].uploadedFile).toBeNull()
    expect(getPresignedUrl).toHaveBeenCalled()
  })

  test('skips presign minting when s3 location is incomplete', async () => {
    const getPresignedUrl = vi.fn()

    const result = await formatSitesForGateway(
      [
        {
          coordinatesType: 'file',
          fileUploadType: 'other-type',
          uploadedFile: { filename: 'site.shp' },
          s3Location: { s3Bucket: 'mmo-uploads' },
          activityDetails: []
        }
      ],
      { getPresignedUrl }
    )

    expect(getPresignedUrl).not.toHaveBeenCalled()
    expect(result[0].uploadedFile).toEqual({
      filename: 'site.shp',
      fileType: 'other-type',
      presignedFileUrl: null
    })
  })

  test('maps manual coordinates labels, circle width, and other activity text', async () => {
    vi.spyOn(siteDetailsModule, 'getSiteCoordinates').mockReturnValue([
      [
        [-1, 51],
        [-1.1, 51],
        [-1.1, 51.1],
        [-1, 51.1],
        [-1, 51]
      ]
    ])

    const result = await formatSitesForGateway([
      {
        siteName: 'Circle site',
        coordinatesType: 'coordinates',
        coordinatesEntry: 'single',
        coordinateSystem: 'wgs84',
        circleWidth: '50',
        activityDetails: [
          {
            activities: {
              selections: 'other',
              otherActivity: 'Custom structure'
            },
            activityDescription: '',
            workingHours: ''
          }
        ]
      }
    ])

    expect(result[0].locationMethod).toBe(
      'Enter the coordinates of the site manually'
    )
    expect(result[0].coordinatesEntry).toBe(
      'Enter a single set of coordinates and a width for a circle'
    )
    expect(result[0].coordinateSystem).toBe(
      'WGS84 (World Geodetic System 1984)'
    )
    expect(result[0].circleWidthMetres).toBe(50)
    expect(result[0].activities[0].otherActivity).toBe('Custom structure')
    expect(result[0].activities[0].activityDescription).toBeNull()
    expect(result[0].activities[0].workingHours).toBeNull()

    vi.restoreAllMocks()
  })

  test('maps OSGB36 multiple-entry coordinate labels', async () => {
    const result = await formatSitesForGateway([
      {
        coordinatesType: 'coordinates',
        coordinatesEntry: 'multiple',
        coordinateSystem: 'osgb36',
        activityDetails: []
      }
    ])

    expect(result[0].coordinatesEntry).toBe(
      'Enter multiple sets of coordinates to mark the boundary of the site'
    )
    expect(result[0].coordinateSystem).toBe('British National Grid (OSGB36)')
    expect(result[0].circleWidthMetres).toBeNull()
  })

  test('handles unknown location method and missing activityDetails', async () => {
    const result = await formatSitesForGateway([
      {
        siteName: 'Incomplete',
        coordinatesType: 'unknown'
      }
    ])

    expect(result[0].locationMethod).toBeNull()
    expect(result[0].coordinatesEntry).toBeNull()
    expect(result[0].coordinateSystem).toBeNull()
    expect(result[0].activities).toEqual([])
  })

  test('uses null fileType when file upload type is absent', async () => {
    const getPresignedUrl = vi.fn().mockResolvedValue('https://example.com/f')

    const result = await formatSitesForGateway(
      [
        {
          coordinatesType: 'file',
          uploadedFile: { filename: 'x.zip' },
          s3Location: { s3Bucket: 'b', s3Key: 'k' },
          activityDetails: []
        }
      ],
      { getPresignedUrl }
    )

    expect(result[0].uploadedFile.fileType).toBeNull()
  })

  test('returns null coordinateEntry labels for unknown entry or system keys', async () => {
    const result = await formatSitesForGateway([
      {
        coordinatesType: 'coordinates',
        coordinatesEntry: 'triangle',
        coordinateSystem: 'etrs89',
        activityDetails: []
      }
    ])

    expect(result[0].coordinatesEntry).toBeNull()
    expect(result[0].coordinateSystem).toBeNull()
  })

  test('does not invent activity labels from keys alone', async () => {
    const result = await formatSitesForGateway([
      {
        siteName: 'Site',
        coordinatesType: 'coordinates',
        activityDetails: [
          {
            activityType: 'construction',
            activitySubType: 'construction-type-1',
            activities: { selections: ['CON14'] }
          }
        ]
      }
    ])

    expect(result[0].activities[0].activityType).toBeNull()
    expect(result[0].activities[0].activitySubType).toBeNull()
    expect(result[0].activities[0].subActivities).toEqual([])
    expect(result[0].uploadedFile).toBeNull()
  })

  test('returns empty array for missing siteDetails', async () => {
    expect(await formatSitesForGateway()).toEqual([])
    expect(await formatSitesForGateway(null)).toEqual([])
  })

  test('uses default blobService when getPresignedUrl is not injected', async () => {
    blobService.getPresignedUrl.mockResolvedValue(
      'https://s3.example.com/from-default'
    )

    const result = await formatSitesForGateway([
      {
        coordinatesType: 'file',
        fileUploadType: 'shapefile',
        uploadedFile: { filename: 'default.zip' },
        s3Location: {
          s3Bucket: 'mmo-uploads',
          s3Key: 'marine-licences/default.zip'
        },
        activityDetails: []
      }
    ])

    expect(blobService.getPresignedUrl).toHaveBeenCalledWith(
      'mmo-uploads',
      'marine-licences/default.zip',
      SITE_FILE_PRESIGNED_URL_EXPIRES_IN_SECONDS
    )
    expect(result[0].uploadedFile.presignedFileUrl).toBe(
      'https://s3.example.com/from-default'
    )
  })
})

describe('buildSiteGeometry', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('builds polygon FeatureCollection from getSiteCoordinates ring', () => {
    vi.spyOn(siteDetailsModule, 'getSiteCoordinates').mockReturnValue([
      [
        [-1, 51],
        [-1.1, 51],
        [-1.1, 51.1],
        [-1, 51.1],
        [-1, 51]
      ]
    ])

    const geometry = buildSiteGeometry(
      {
        coordinatesType: 'coordinates',
        coordinatesEntry: 'multiple',
        siteName: 'Manual site'
      },
      1
    )

    expect(geometry.features[0].geometry.type).toBe('Polygon')
    expect(geometry.features[0].properties).toEqual({
      siteIndex: 1,
      siteName: 'Manual site'
    })
  })

  test('returns null when site is missing', () => {
    expect(buildSiteGeometry(null, 0)).toBeNull()
  })

  test('returns null when file site has no geoJSON features', () => {
    expect(
      buildSiteGeometry(
        {
          coordinatesType: 'file',
          geoJSON: { type: 'FeatureCollection', features: [] }
        },
        0
      )
    ).toBeNull()
  })

  test('builds geometry for file site and merges feature properties', () => {
    const geometry = buildSiteGeometry(
      {
        coordinatesType: 'file',
        siteName: 'File site',
        geoJSON: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { id: 'a' },
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 0]
                  ]
                ]
              }
            }
          ]
        }
      },
      2
    )

    expect(geometry.features[0].properties).toEqual({
      id: 'a',
      siteIndex: 2,
      siteName: 'File site'
    })
  })

  test('returns null when getSiteCoordinates yields empty coords', () => {
    vi.spyOn(siteDetailsModule, 'getSiteCoordinates').mockReturnValue([[]])

    expect(
      buildSiteGeometry(
        { coordinatesType: 'coordinates', coordinatesEntry: 'multiple' },
        0
      )
    ).toBeNull()
  })

  test('returns null when coordinate format is not a ring of numbers', () => {
    vi.spyOn(siteDetailsModule, 'getSiteCoordinates').mockReturnValue([
      [{ easting: '1', northing: '2' }]
    ])

    expect(
      buildSiteGeometry(
        { coordinatesType: 'coordinates', coordinatesEntry: 'multiple' },
        0
      )
    ).toBeNull()
  })

  test('returns null when getSiteCoordinates throws', () => {
    vi.spyOn(siteDetailsModule, 'getSiteCoordinates').mockImplementation(() => {
      throw new Error('bad geometry')
    })

    expect(
      buildSiteGeometry(
        { coordinatesType: 'coordinates', coordinatesEntry: 'multiple' },
        0
      )
    ).toBeNull()
  })

  test('returns null when getSiteCoordinates returns no groups', () => {
    vi.spyOn(siteDetailsModule, 'getSiteCoordinates').mockReturnValue([])

    expect(
      buildSiteGeometry(
        { coordinatesType: 'coordinates', coordinatesEntry: 'multiple' },
        0
      )
    ).toBeNull()
  })
})
