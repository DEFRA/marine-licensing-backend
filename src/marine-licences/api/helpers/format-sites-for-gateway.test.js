import { describe, expect, test, vi } from 'vitest'
import {
  buildSiteGeometry,
  formatActivityDuration,
  formatCompletionDateForGateway,
  formatSitesForGateway,
  SITE_FILE_PRESIGNED_URL_EXPIRES_IN_SECONDS
} from './format-sites-for-gateway.js'
import * as siteDetailsModule from '../csv/site-details.js'

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

  test('returns years and months together', () => {
    expect(formatActivityDuration({ years: 1, months: 3 })).toBe(
      '1 year 3 months'
    )
  })

  test('returns null when empty', () => {
    expect(formatActivityDuration({})).toBeNull()
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
})

describe('buildSiteGeometry', () => {
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

    vi.restoreAllMocks()
  })
})
