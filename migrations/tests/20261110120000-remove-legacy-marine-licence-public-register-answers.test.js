import { up } from '../20261110120000-remove-legacy-marine-licence-public-register-answers.js'
import { collectionMarineLicences } from '../../src/shared/common/constants/db-collections.js'
import { MARINE_LICENCE_STATUS } from '../../src/marine-licences/constants/marine-licence.js'

describe('remove-legacy-marine-licence-public-register-answers', () => {
  const licences = () => global.mockMongo.collection(collectionMarineLicences)
  const updatedAt = new Date('2026-01-01T00:00:00.000Z')

  const publicRegisterFor = async (applicationReference) =>
    (await licences().findOne({ applicationReference })).publicRegister

  beforeEach(async () => {
    await licences().deleteMany({})
    await licences().insertMany([
      {
        applicationReference: 'LEGACY-DRAFT',
        status: MARINE_LICENCE_STATUS.DRAFT,
        publicRegister: { withholdConsent: 'yes', reason: 'Free text' },
        updatedAt
      },
      {
        applicationReference: 'CURRENT-DRAFT',
        status: MARINE_LICENCE_STATUS.DRAFT,
        publicRegister: {
          withholdConsent: 'yes',
          withholdReason: 'nationalSecurity'
        },
        updatedAt
      },
      {
        applicationReference: 'NOT-WITHHELD-DRAFT',
        status: MARINE_LICENCE_STATUS.DRAFT,
        publicRegister: { withholdConsent: 'no', reason: null },
        updatedAt
      },
      {
        applicationReference: 'LEGACY-SUBMITTED',
        status: MARINE_LICENCE_STATUS.SUBMITTED,
        publicRegister: { withholdConsent: 'yes', reason: 'Free text' },
        updatedAt
      }
    ])
  })

  it('should clear the answer on a draft that withheld information without a withholdReason', async () => {
    await up(global.mockMongo)

    expect(await publicRegisterFor('LEGACY-DRAFT')).toBeUndefined()
  })

  it.each([
    [
      'a draft that already has a withholdReason',
      'CURRENT-DRAFT',
      { withholdConsent: 'yes', withholdReason: 'nationalSecurity' }
    ],
    [
      'a draft that withheld nothing',
      'NOT-WITHHELD-DRAFT',
      { withholdConsent: 'no', reason: null }
    ],
    [
      'a submitted licence',
      'LEGACY-SUBMITTED',
      { withholdConsent: 'yes', reason: 'Free text' }
    ]
  ])('should leave %s untouched', async (_description, reference, expected) => {
    await up(global.mockMongo)

    expect(await publicRegisterFor(reference)).toEqual(expected)
  })

  it('should leave updatedAt untouched', async () => {
    await up(global.mockMongo)

    const licence = await licences().findOne({
      applicationReference: 'LEGACY-DRAFT'
    })
    expect(licence.updatedAt).toEqual(updatedAt)
  })
})
