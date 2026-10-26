import { buildConsultationMarineLicenceResponse } from './build-consultation-marine-licence-response.js'
import { requestFromApplicantUser } from '../../../../.vite/mocks.js'

describe('buildConsultationMarineLicenceResponse', () => {
  const mockId = '123456789123456789123456'
  const request = requestFromApplicantUser({ userContactId: 'abc' })

  it("should omit other organisations' consultations", () => {
    const marineLicence = {
      _id: mockId,
      projectName: 'Test project',
      consultationRequests: [
        {
          consultationStartDate: '2026-03-01T00:00:00.000Z',
          consultees: [{ organisationId: 'org-1' }, { organisationId: 'org-2' }]
        },
        {
          consultationStartDate: '2026-04-01T00:00:00.000Z',
          consultees: [{ organisationId: 'org-2' }]
        }
      ]
    }

    const response = buildConsultationMarineLicenceResponse(
      marineLicence,
      request,
      'org-1'
    )

    expect(response.id).toBe(mockId)
    expect(response.projectName).toBe('Test project')
    expect(response.consultationRequests).toEqual([
      {
        consultationStartDate: '2026-03-01T00:00:00.000Z',
        consultees: [{ organisationId: 'org-1' }]
      }
    ])
  })

  it('should return no consultations when the licence has none', () => {
    const response = buildConsultationMarineLicenceResponse(
      { _id: mockId },
      request,
      'org-1'
    )

    expect(response.consultationRequests).toEqual([])
  })
})
