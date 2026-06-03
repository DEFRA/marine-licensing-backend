import { COORDINATE_SYSTEMS } from '../../../shared/common/constants/coordinates.js'
import { EXEMPTION_STATUS } from '../../constants/exemption.js'

const SUMMARY_STATUSES = [
  EXEMPTION_STATUS.ACTIVE,
  EXEMPTION_STATUS.SUBMITTED,
  EXEMPTION_STATUS.DRAFT,
  EXEMPTION_STATUS.WITHDRAWN
]

const REPORTING_STATUSES = [
  EXEMPTION_STATUS.ACTIVE,
  EXEMPTION_STATUS.SUBMITTED,
  EXEMPTION_STATUS.WITHDRAWN
]

const excludeDraftExemptionsMatch = {
  $match: {
    status: { $in: REPORTING_STATUSES }
  }
}

const reportingFacet = (stages) => [excludeDraftExemptionsMatch, ...stages]

const countExemptionsWithSiteMatch = (siteMatch) =>
  reportingFacet([
    { $match: { siteDetails: { $elemMatch: siteMatch } } },
    { $count: 'count' }
  ])

const groupByFieldFacet = (field) =>
  reportingFacet([
    { $unwind: `$${field}` },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } }
  ])

const buildReportingFacets = () => ({
  shapefileExemptions: countExemptionsWithSiteMatch({
    coordinatesType: 'file',
    fileUploadType: 'shapefile'
  }),
  kmlExemptions: countExemptionsWithSiteMatch({
    coordinatesType: 'file',
    fileUploadType: 'kml'
  }),
  manualCoordinatesExemptions: countExemptionsWithSiteMatch({
    coordinatesType: 'coordinates'
  }),
  coordinateSystemVolume: reportingFacet([
    { $unwind: '$siteDetails' },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ['$siteDetails.coordinatesType', 'file'] },
            COORDINATE_SYSTEMS.WGS84,
            '$siteDetails.coordinateSystem'
          ]
        },
        count: { $sum: 1 }
      }
    }
  ]),
  byArticle: reportingFacet([
    {
      $match: {
        'mcmsContext.articleCode': { $exists: true, $nin: [null, ''] }
      }
    },
    { $group: { _id: '$mcmsContext.articleCode', count: { $sum: 1 } } }
  ]),
  byMarinePlanArea: groupByFieldFacet('marinePlanAreas'),
  byCoastalOperationsArea: groupByFieldFacet('coastalOperationsAreas')
})

export const buildExemptionSummaryPipeline = () => [
  {
    $match: {
      status: { $in: SUMMARY_STATUSES }
    }
  },
  {
    $facet: {
      statusCounts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
      ...buildReportingFacets()
    }
  }
]

const countFromFacet = (facetResult) => facetResult[0]?.count ?? 0

const groupedCountsToRecord = (groupedCounts) =>
  groupedCounts.reduce((acc, item) => {
    if (item._id != null) {
      acc[item._id] = item.count
    }
    return acc
  }, {})

const calculatePercentage = (count, total) =>
  total > 0 ? Math.round((count / total) * 1000) / 10 : 0

export const buildCoordinateSystemVolume = (groupedCounts) => {
  const countsBySystem = groupedCountsToRecord(groupedCounts)
  const wgs84Count = countsBySystem[COORDINATE_SYSTEMS.WGS84] ?? 0
  const bngCount = countsBySystem[COORDINATE_SYSTEMS.OSGB36] ?? 0
  const total = wgs84Count + bngCount

  return {
    wgs84: {
      count: wgs84Count,
      percentage: calculatePercentage(wgs84Count, total)
    },
    bng: {
      count: bngCount,
      percentage: calculatePercentage(bngCount, total)
    },
    total
  }
}

export const buildExemptionSummaryValue = ({
  statusCounts,
  shapefileExemptions,
  kmlExemptions,
  manualCoordinatesExemptions,
  coordinateSystemVolume,
  byArticle,
  byMarinePlanArea,
  byCoastalOperationsArea
}) => {
  const countsByStatus = groupedCountsToRecord(statusCounts)

  const submittedExemptions =
    (countsByStatus[EXEMPTION_STATUS.ACTIVE] ?? 0) +
    (countsByStatus[EXEMPTION_STATUS.SUBMITTED] ?? 0)

  return {
    submittedExemptions,
    unsubmittedExemptions: countsByStatus[EXEMPTION_STATUS.DRAFT] ?? 0,
    withdrawnExemptions: countsByStatus[EXEMPTION_STATUS.WITHDRAWN] ?? 0,
    coordinatesInputMethod: {
      shapefile: countFromFacet(shapefileExemptions),
      kml: countFromFacet(kmlExemptions),
      manualCoordinates: countFromFacet(manualCoordinatesExemptions)
    },
    coordinateSystemVolume: buildCoordinateSystemVolume(coordinateSystemVolume),
    byArticle: groupedCountsToRecord(byArticle),
    byMarinePlanArea: groupedCountsToRecord(byMarinePlanArea),
    byCoastalOperationsArea: groupedCountsToRecord(byCoastalOperationsArea)
  }
}
