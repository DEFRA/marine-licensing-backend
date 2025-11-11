import { isOrganisationEmployee } from '../../organisations.js'
import { getProjectStartEndDates } from './get-project-start-end-dates.js'
import { shortIsoDate } from './short-iso-date.js'
import { transformSiteDetails } from './site-details.js'

export const transformExemptionToEmpRequest = ({
  exemption,
  applicantName
}) => {
  const { organisation, mcmsContext, publicRegister, siteDetails } = exemption
  const applicantOrgName = isOrganisationEmployee(organisation)
    ? organisation?.name
    : undefined

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
      PubConsent: publicConsent
    },
    geometry: {
      rings: transformSiteDetails(siteDetails),
      spatialReference: {
        wkid: 4258
      }
    }
  }
}
