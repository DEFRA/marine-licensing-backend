import { expect } from 'vitest'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'
import {
  buildCoordinateSystemVolume,
  buildExemptionSummaryPipeline,
  buildExemptionSummaryValue
} from './exemption-summary.js'

describe('exemption-summary helper', () => {
  describe('buildExemptionSummaryPipeline', () => {
    it('includes status match and facet aggregations', () => {
      const pipeline = buildExemptionSummaryPipeline()

      expect(pipeline).toHaveLength(2)
      expect(pipeline[0].$match.status.$in).toEqual([
        EXEMPTION_STATUS.ACTIVE,
        EXEMPTION_STATUS.SUBMITTED,
        EXEMPTION_STATUS.DRAFT,
        EXEMPTION_STATUS.WITHDRAWN
      ])
      expect(pipeline[1].$facet.shapefileExemptions[0]).toEqual({
        $match: {
          status: {
            $in: [
              EXEMPTION_STATUS.ACTIVE,
              EXEMPTION_STATUS.SUBMITTED,
              EXEMPTION_STATUS.WITHDRAWN
            ]
          }
        }
      })
      expect(pipeline[1].$facet).toMatchObject({
        statusCounts: expect.any(Array),
        shapefileExemptions: expect.any(Array),
        kmlExemptions: expect.any(Array),
        manualCoordinatesExemptions: expect.any(Array),
        coordinateSystemVolume: expect.any(Array),
        byArticle: expect.any(Array),
        byMarinePlanArea: expect.any(Array),
        byCoastalOperationsArea: expect.any(Array)
      })
    })
  })

  describe('buildCoordinateSystemVolume', () => {
    it('calculates WGS84 and BNG counts and percentages', () => {
      expect(
        buildCoordinateSystemVolume([
          { _id: 'wgs84', count: 3 },
          { _id: 'osgb36', count: 1 }
        ])
      ).toEqual({
        wgs84: { count: 3, percentage: 75 },
        bng: { count: 1, percentage: 25 },
        total: 4
      })
    })

    it('returns zero percentages when there is no site data', () => {
      expect(buildCoordinateSystemVolume([])).toEqual({
        wgs84: { count: 0, percentage: 0 },
        bng: { count: 0, percentage: 0 },
        total: 0
      })
    })
  })

  describe('buildExemptionSummaryValue', () => {
    it('maps facet aggregation results into the summary response', () => {
      expect(
        buildExemptionSummaryValue({
          statusCounts: [
            { _id: EXEMPTION_STATUS.ACTIVE, count: 4 },
            { _id: EXEMPTION_STATUS.SUBMITTED, count: 2 },
            { _id: EXEMPTION_STATUS.DRAFT, count: 3 },
            { _id: EXEMPTION_STATUS.WITHDRAWN, count: 1 }
          ],
          shapefileExemptions: [{ count: 2 }],
          kmlExemptions: [{ count: 1 }],
          manualCoordinatesExemptions: [{ count: 5 }],
          coordinateSystemVolume: [
            { _id: 'wgs84', count: 6 },
            { _id: 'osgb36', count: 2 }
          ],
          byArticle: [
            { _id: '25', count: 3 },
            { _id: '17', count: 2 }
          ],
          byMarinePlanArea: [{ _id: 'East inshore', count: 2 }],
          byCoastalOperationsArea: [{ _id: 'South', count: 1 }]
        })
      ).toEqual({
        submittedExemptions: 6,
        unsubmittedExemptions: 3,
        withdrawnExemptions: 1,
        coordinatesInputMethod: {
          shapefile: 2,
          kml: 1,
          manualCoordinates: 5
        },
        coordinateSystemVolume: {
          wgs84: { count: 6, percentage: 75 },
          bng: { count: 2, percentage: 25 },
          total: 8
        },
        byArticle: {
          25: 3,
          17: 2
        },
        byMarinePlanArea: {
          'East inshore': 2
        },
        byCoastalOperationsArea: {
          South: 1
        }
      })
    })

    it('maps reporting metrics independently of draft status counts', () => {
      expect(
        buildExemptionSummaryValue({
          statusCounts: [{ _id: EXEMPTION_STATUS.DRAFT, count: 5 }],
          shapefileExemptions: [],
          kmlExemptions: [],
          manualCoordinatesExemptions: [{ count: 2 }],
          coordinateSystemVolume: [{ _id: 'wgs84', count: 2 }],
          byArticle: [],
          byMarinePlanArea: [],
          byCoastalOperationsArea: []
        })
      ).toMatchObject({
        unsubmittedExemptions: 5,
        coordinatesInputMethod: {
          shapefile: 0,
          kml: 0,
          manualCoordinates: 2
        }
      })
    })

    it('returns zero counts when facet results are empty', () => {
      expect(
        buildExemptionSummaryValue({
          statusCounts: [],
          shapefileExemptions: [],
          kmlExemptions: [],
          manualCoordinatesExemptions: [],
          coordinateSystemVolume: [],
          byArticle: [],
          byMarinePlanArea: [],
          byCoastalOperationsArea: []
        })
      ).toEqual({
        submittedExemptions: 0,
        unsubmittedExemptions: 0,
        withdrawnExemptions: 0,
        coordinatesInputMethod: {
          shapefile: 0,
          kml: 0,
          manualCoordinates: 0
        },
        coordinateSystemVolume: {
          wgs84: { count: 0, percentage: 0 },
          bng: { count: 0, percentage: 0 },
          total: 0
        },
        byArticle: {},
        byMarinePlanArea: {},
        byCoastalOperationsArea: {}
      })
    })
  })
})
