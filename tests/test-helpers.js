import { expect } from 'vitest'
import { collectionMarineLicences } from '../src/shared/common/constants/db-collections.js'
import { createCompleteMarineLicence } from './test.fixture.js'

export const flushPromises = () =>
  new Promise((resolve) => setTimeout(resolve, 0))

export const expectRecentDate = (value, since) => {
  expect(value).toBeInstanceOf(Date)
  expect(value.getTime()).toBeGreaterThanOrEqual(since)
  expect(value.getTime()).toBeLessThanOrEqual(Date.now())
}

export const insertMarineLicence = async (overrides = {}) => {
  const marineLicence = createCompleteMarineLicence(overrides)
  await globalThis.mockMongo
    .collection(collectionMarineLicences)
    .insertOne(marineLicence)
  return marineLicence
}

export const findMarineLicence = (_id) =>
  globalThis.mockMongo.collection(collectionMarineLicences).findOne({ _id })
