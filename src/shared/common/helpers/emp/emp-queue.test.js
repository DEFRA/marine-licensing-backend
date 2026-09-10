import { empFeaturesCreated } from './emp-queue.js'
import { EMP_REQUEST_ACTIONS } from '../../constants/request-queue.js'

describe('empFeaturesCreated', () => {
  let collection

  beforeEach(async () => {
    collection = globalThis.mockMongo.collection('emp-queue-filter-fixture')
    await collection.deleteMany({})
  })

  const matching = async () =>
    (await collection.find(empFeaturesCreated).toArray()).map(
      (row) => row.applicationReferenceNumber
    )

  it('matches the row that created the features', async () => {
    await collection.insertOne({
      applicationReferenceNumber: 'ADD',
      action: EMP_REQUEST_ACTIONS.ADD,
      empFeatureIds: ['1']
    })

    expect(await matching()).toEqual(['ADD'])
  })

  it('matches a legacy row that predates the action field', async () => {
    await collection.insertOne({
      applicationReferenceNumber: 'LEGACY',
      empFeatureIds: ['1']
    })

    expect(await matching()).toEqual(['LEGACY'])
  })

  it('matches a legacy row holding a single empFeatureId', async () => {
    await collection.insertOne({
      applicationReferenceNumber: 'SINGLE',
      action: EMP_REQUEST_ACTIONS.ADD,
      empFeatureId: 'only-one'
    })

    expect(await matching()).toEqual(['SINGLE'])
  })

  it('ignores rows that merely echo the ids back', async () => {
    await collection.insertMany([
      {
        applicationReferenceNumber: 'WITHDRAW',
        action: EMP_REQUEST_ACTIONS.WITHDRAW,
        empFeatureIds: ['1']
      },
      {
        applicationReferenceNumber: 'UPDATE',
        action: EMP_REQUEST_ACTIONS.UPDATE_STATUS,
        empFeatureIds: ['1']
      }
    ])

    expect(await matching()).toEqual([])
  })

  it('ignores a row that never recorded any ids', async () => {
    await collection.insertOne({
      applicationReferenceNumber: 'PENDING',
      action: EMP_REQUEST_ACTIONS.ADD
    })

    expect(await matching()).toEqual([])
  })
})
