import { setupTestServer } from '../../../../tests/test-server.js'
import { ObjectId } from 'mongodb'
import {
  mockWaterFrameworkDirective,
  mockMarinePlanPolicies,
  mockMarinePlanPolicyResponses
} from '../../../../tests/test.fixture.js'
import { mockMarineLicence } from '../../models/test-fixtures.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { collectionMarinePlanPolicyWordingSnapshots } from '../../../shared/common/constants/db-collections.js'

vi.mock('../../../shared/services/data-service/blob-service.js', () => ({
  blobService: {
    getPresignedUrl: vi.fn()
  }
}))

describe('GET /public/marine-licence/mas/{id} - integration tests', async () => {
  const getServer = await setupTestServer()
  const backendGatewayUrl = 'http://localhost:3001'

  test('returns project fields for a SUBMITTED marine licence', async () => {
    const publicId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: publicId,
      projectName: 'Harbour dredging',
      projectBackground: 'Maintenance of navigation channel',
      preferredDates: {
        start: { month: '08', year: '2026' },
        end: { month: '11', year: '2026' }
      },
      publicRegister: {
        consent: 'no',
        reason: 'Commercial confidentiality'
      },
      specialLegalPowers: {
        agree: 'yes',
        details: 'Harbour powers under local Act'
      },
      harbourAuthority: {
        area: 'yes',
        details: 'Port of Example'
      },
      otherAuthorities: {
        agree: 'yes',
        details: 'Planning permission from local authority'
      },
      publicConsultation: {
        consulted: 'yes',
        details: 'Consultation with stakeholders'
      },
      waterFrameworkDirective: mockWaterFrameworkDirective,
      status: MARINE_LICENCE_STATUS.SUBMITTED
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const response = await getServer().inject({
      method: 'GET',
      url: `/public/marine-licence/mas/${publicId}`
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload)).toEqual({
      projectName: 'Harbour dredging',
      projectBackground: 'Maintenance of navigation channel',
      preferredLicenceDates: 'August 2026 to November 2026',
      publicRegister: {
        consent: 'no',
        reason: 'Commercial confidentiality'
      },
      specialLegalPowers: {
        agree: 'yes',
        details: 'Harbour powers under local Act'
      },
      harbourAuthority: {
        area: 'yes',
        details: 'Port of Example'
      },
      otherAuthorities: {
        agree: 'yes',
        details: 'Planning permission from local authority'
      },
      publicConsultation: {
        consulted: 'yes',
        details: 'Consultation with stakeholders'
      },
      waterFrameworkDirective: {
        nauticalMile: 'yes',
        excludedActivities: 'no',
        documentUrl: `${backendGatewayUrl}/public/marine-licence/${publicId}/water-framework-directive/download-url`,
        fileName: mockWaterFrameworkDirective.uploadedFile.filename
      },
      sites: [],
      marinePlanPolicies: []
    })
  })

  test('returns 403 when requesting a DRAFT marine licence', async () => {
    const draftId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: draftId,
      status: MARINE_LICENCE_STATUS.DRAFT
    }

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const response = await getServer().inject({
      method: 'GET',
      url: `/public/marine-licence/mas/${draftId}`
    })

    expect(response.statusCode).toBe(403)
  })

  test('returns 404 when marine licence does not exist', async () => {
    const response = await getServer().inject({
      method: 'GET',
      url: `/public/marine-licence/mas/${new ObjectId()}`
    })

    expect(response.statusCode).toBe(404)
  })

  test('returns marine plan policies with hydrated wording and applicant answers', async () => {
    const publicId = new ObjectId()
    const marineLicence = {
      ...mockMarineLicence,
      _id: publicId,
      status: MARINE_LICENCE_STATUS.SUBMITTED,
      marinePlanPolicies: mockMarinePlanPolicies,
      marinePlanPolicyResponses: mockMarinePlanPolicyResponses
    }

    await globalThis.mockMongo
      .collection(collectionMarinePlanPolicyWordingSnapshots)
      .insertMany([
        {
          _id: 'E-AGG-3@9e9f836e1cf8',
          policyCode: 'E-AGG-3',
          policy: '<p>Aggregates policy statement.</p>'
        },
        {
          _id: 'E-MPA-1@74fa5919499c',
          policyCode: 'E-MPA-1',
          policy: '<p>Marine protected areas policy statement.</p>'
        },
        {
          _id: 'E-BIO-1@5548bada4132',
          policyCode: 'E-BIO-1',
          policy: '<p>Biodiversity policy statement.</p>'
        }
      ])

    await globalThis.mockMongo
      .collection('marine-licences')
      .insertOne(marineLicence)

    const response = await getServer().inject({
      method: 'GET',
      url: `/public/marine-licence/mas/${publicId}`
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload).marinePlanPolicies).toEqual([
      {
        policyCode: 'E-AGG-3',
        policyInformation: '<p>Aggregates policy statement.</p>',
        applicantAnswer: 'test'
      },
      {
        policyCode: 'E-MPA-1',
        policyInformation: '<p>Marine protected areas policy statement.</p>',
        applicantAnswer: 'test'
      },
      {
        policyCode: 'E-BIO-1',
        policyInformation: '<p>Biodiversity policy statement.</p>',
        applicantAnswer: 'test'
      }
    ])
  })
})
