import { buildMarineLicenceResponse } from './build-marine-licence-response.js'

export const buildConsultationMarineLicenceResponse = (
  marineLicence,
  request,
  organisationId
) => ({
  ...buildMarineLicenceResponse(marineLicence, request),
  consultationRequests: (marineLicence.consultationRequests ?? [])
    .map((consultationRequest) => ({
      ...consultationRequest,
      consultees: consultationRequest.consultees.filter(
        (consultee) => consultee.organisationId === organisationId
      )
    }))
    .filter(({ consultees }) => consultees.length)
})
