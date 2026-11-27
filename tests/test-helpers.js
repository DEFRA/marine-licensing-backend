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

// Coordinates from proj4 can vary in their last few digits between releases,
// so they are compared to a fixed number of decimal places rather than exactly.
// 8 decimal places of a degree is around 1mm on the ground, two places tighter
// than the 6 (around 10cm) the service needs.
const COORDINATE_DECIMAL_PLACES = 8

export const closeToCoordinates = (value) =>
  Array.isArray(value)
    ? value.map(closeToCoordinates)
    : expect.closeTo(value, COORDINATE_DECIMAL_PLACES)

export const insertMarineLicence = async (overrides = {}) => {
  const marineLicence = createCompleteMarineLicence(overrides)
  await globalThis.mockMongo
    .collection(collectionMarineLicences)
    .insertOne(marineLicence)
  return marineLicence
}

export const findMarineLicence = (_id) =>
  globalThis.mockMongo.collection(collectionMarineLicences).findOne({ _id })
