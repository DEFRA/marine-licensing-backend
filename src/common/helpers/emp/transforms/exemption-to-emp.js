import { getProjectStartEndDates } from './get-project-start-end-dates.js'
import { shortIsoDate } from './short-iso-date.js'
import { transformSiteDetails } from './site-details.js'
import { config } from '../../../../config.js'

export const transformExemptionToEmpRequest = ({ exemption }) => {
  const frontEndBaseUrl = config.get('frontEndBaseUrl')
  const { mcmsContext, publicRegister, siteDetails } = exemption

  const publicConsent = publicRegister?.consent === 'no' ? 'No' : 'Yes'

  const { start: startDate, end: endDate } =
    getProjectStartEndDates(siteDetails)

  const projStartDate = startDate ? shortIsoDate(new Date(startDate)) : ''
  const projEndDate = endDate ? shortIsoDate(new Date(endDate)) : ''

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
      ProjEndDate: projEndDate,
      SubDate: shortIsoDate(new Date(exemption.submittedAt)),
      PubConsent: publicConsent,
      Exemptions_URL: new URL(
        `/exemption/view-public-details/${exemption._id}`,
        frontEndBaseUrl
      ).toString(),
      CoastalOperationsArea:
        exemption.coastalEnforcementAreas?.join(', ') || '',
      MarinePlanArea: exemption.marinePlanAreas?.join(', ') || ''
    },
    geometry: transformSiteDetails(siteDetails)
  }
}
