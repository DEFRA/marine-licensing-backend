import { format } from 'date-fns'
import { getProjectStartEndDates } from './get-project-start-end-dates.js'
import { shortIsoDate } from './short-iso-date.js'
import { transformSiteDetails } from './site-details.js'
import { config } from '../../../../../config.js'

function getFormattedDates(startDate, endDate, exemption) {
  const shortDateFormat = 'd MMM yyyy'
  const projStartDateFormatted = startDate
    ? format(new Date(startDate), shortDateFormat)
    : ''
  const projEndDateFormatted = endDate
    ? format(new Date(endDate), shortDateFormat)
    : ''
  const subDateFormatted = format(
    new Date(exemption.submittedAt),
    shortDateFormat
  )
  return { projStartDateFormatted, projEndDateFormatted, subDateFormatted }
}

export const transformExemptionToEmpRequest = ({ exemption }) => {
  const frontEndBaseUrl = config.get('frontEndBaseUrl')
  const { mcmsContext, publicRegister, siteDetails } = exemption

  const publicConsent = publicRegister?.consent === 'no' ? 'No' : 'Yes'

  const { start: startDate, end: endDate } =
    getProjectStartEndDates(siteDetails)

  const projStartDate = startDate ? shortIsoDate(new Date(startDate)) : ''
  const projEndDate = endDate ? shortIsoDate(new Date(endDate)) : ''
  const subDate = shortIsoDate(new Date(exemption.submittedAt))

  const { projStartDateFormatted, projEndDateFormatted, subDateFormatted } =
    getFormattedDates(startDate, endDate, exemption)

  return {
    attributes: {
      CaseReference: exemption.applicationReference,
      Status: 'Active',
      ApplicationTy: 'Exempt activity notification',
      ApplicantName: exemption.whoExemptionIsFor || '',
      Project: exemption.projectName,
      ActivityTy: mcmsContext?.activity?.label,
      SubActTy: mcmsContext?.activity?.purpose || '',
      ArticleNo: mcmsContext?.articleCode
        ? `Article ${mcmsContext?.articleCode}`
        : '',
      IAT_URL: mcmsContext?.pdfDownloadUrl,
      ProjStartDate: projStartDate,
      ProjStartDateFormatted: projStartDateFormatted,
      ProjEndDate: projEndDate,
      ProjEndDateFormatted: projEndDateFormatted,
      SubDate: subDate,
      SubDateFormatted: subDateFormatted,
      PubConsent: publicConsent,
      Exemptions_URL: new URL(
        `/exemption/view-public-details/${exemption._id}`,
        frontEndBaseUrl
      ).toString(),
      CoastalOperationsArea: exemption.coastalOperationsAreas?.join(', ') || '',
      MarinePlanArea: exemption.marinePlanAreas?.join(', ') || ''
    },
    geometry: transformSiteDetails(siteDetails)
  }
}
