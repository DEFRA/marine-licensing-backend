import { publicExemptionResponseSchema } from './public-exemption-response.js'

const validResponse = {
  message: 'success',
  value: {
    id: '507f1f77bcf86cd799439011',
    status: 'Active',
    projectName: 'Test Marine Project',
    whoExemptionIsFor: 'Test Organisation Ltd',
    publicRegister: { consent: 'yes' },
    siteDetails: [{ coordinatesType: 'coordinates' }],
    createdAt: new Date('2026-12-01'),
    updatedAt: new Date('2026-12-01'),
    contactId: '123e4567-e89b-12d3-a456-426614174000',
    taskList: { projectName: 'COMPLETED' }
  }
}

describe('publicExemptionResponseSchema', () => {
  test('accepts a public exemption response with extra stored fields', () => {
    expect(
      publicExemptionResponseSchema.validate(validResponse).error
    ).toBeUndefined()
  })

  test('rejects a response without a task list', () => {
    const { taskList: _taskList, ...value } = validResponse.value

    expect(
      publicExemptionResponseSchema.validate({ ...validResponse, value }).error
    ).toBeDefined()
  })
})
