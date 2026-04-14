import { ObjectId } from 'mongodb'
import { updateSiteSchema } from './update-site.js'
import { mockFileUploadSite } from '../../../../tests/test.fixture.js'

describe('updateSiteSchema', () => {
  const validId = new ObjectId().toHexString()

  it.each([
    [
      'missing id',
      { siteIndex: 0, siteDetails: mockFileUploadSite },
      'MARINE_LICENCE_ID_REQUIRED'
    ],
    [
      'missing siteIndex',
      { id: validId, siteDetails: mockFileUploadSite },
      'SITE_INDEX_REQUIRED'
    ],
    [
      'negative siteIndex',
      { id: validId, siteIndex: -1, siteDetails: mockFileUploadSite },
      'SITE_INDEX_INVALID'
    ],
    [
      'non-integer siteIndex',
      { id: validId, siteIndex: 1.5, siteDetails: mockFileUploadSite },
      'SITE_INDEX_INVALID'
    ]
  ])('should fail when %s', (_label, input, expectedMessage) => {
    const { error } = updateSiteSchema.validate(input)
    expect(error.message).toContain(expectedMessage)
  })

  it('should pass with a valid file upload site payload', () => {
    const { error } = updateSiteSchema.validate({
      id: validId,
      siteIndex: 0,
      siteDetails: mockFileUploadSite
    })
    expect(error).toBeUndefined()
  })
})
