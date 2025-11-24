import { isOrganisationEmployee } from '../../organisations.js'
import { getProjectStartEndDates } from './get-project-start-end-dates.js'
import { shortIsoDate } from './short-iso-date.js'
import { transformSiteDetails } from './site-details.js'
import { config } from '../../../../config.js'

export const transformExemptionToEmpRequest = ({
  exemption,
  applicantName
}) => {
  const frontEndBaseUrl = config.get('frontEndBaseUrl')
  const { organisation, mcmsContext, publicRegister, siteDetails } = exemption
  const applicantOrgName = isOrganisationEmployee(organisation)
    ? organisation?.name
    : undefined

  // this is counter-intuitive and we're going to ask the EMP team to change to
  //  'no' is 0 and 'yes' is 1
  const publicConsent = publicRegister?.consent === 'no' ? '1' : '0'

  const { start: startDate, end: endDate } =
    getProjectStartEndDates(siteDetails)

  const projStartDate = startDate ? shortIsoDate(new Date(startDate)) : ''
  const projEndDate = endDate ? shortIsoDate(new Date(endDate)) : ''

  return {
    attributes: {
      CaseReference: exemption.applicationReference,
      ApplicationTy: 'Exemption notification',
      ApplicantID: exemption.contactId,
      ApplicantName: applicantName,
      ApplicantOrg: applicantOrgName,
      ClientOrgID: organisation?.id,
      ClientOrgName: organisation?.name,
      Project: exemption.projectName,
      ActivityTy: mcmsContext?.activity?.label,
      SubActTy: mcmsContext?.activity?.purpose,
      ArticleNo: mcmsContext?.articleCode,
      IAT_URL: mcmsContext?.pdfDownloadUrl,
      ProjStartDate: projStartDate,
      ProjEndDate: projEndDate,
      Status: 'Closed',
      SubDate: shortIsoDate(new Date(exemption.submittedAt)),
      PubConsent: publicConsent,
      Exemptions_URL: `${frontEndBaseUrl}/exemption/view-public-details/${exemption._id}`
    },
    geometry: transformSiteDetails(siteDetails)
  }
}
