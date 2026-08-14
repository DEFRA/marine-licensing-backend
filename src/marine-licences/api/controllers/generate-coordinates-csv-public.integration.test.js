import { vi } from 'vitest'
import { ObjectId } from 'mongodb'
import AdmZip from 'adm-zip'
import { setupTestServer } from '../../../../tests/test-server.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'
import { buildCoordinatesCsvPathById } from '../../constants/coordinates-csv.js'
import {
  createCompleteMarineLicence,
  mockCircleSite,
  mockFileUploadSite,
  mockMultipleSite
} from '../../../../tests/test.fixture.js'

vi.mock('adm-zip', () => ({
  default: vi.fn(function () {})
}))

describe('Generate coordinates CSV by id - public integration tests', async () => {
  const getServer = await setupTestServer()
  const marineLicenceId = new ObjectId()

  const addFile = vi.fn()

  beforeEach(() => {
    addFile.mockClear()
    AdmZip.mockImplementation(function () {
      return { addFile, toBuffer: vi.fn(() => Buffer.from('zip-bytes')) }
    })
  })

  const csvFromLastZip = () => addFile.mock.calls[0][1].toString()

  const mockLicence = createCompleteMarineLicence({
    _id: marineLicenceId,
    status: MARINE_LICENCE_STATUS.SUBMITTED
  })

  const insertSubmittedMarineLicence = async (overrides = {}) => {
    await globalThis.mockMongo.collection('marine-licences').insertOne({
      ...mockLicence,
      ...overrides
    })
  }

  test('returns 200 with correct headers without authentication', async () => {
    await insertSubmittedMarineLicence()

    const response = await getServer().inject({
      method: 'GET',
      url: buildCoordinatesCsvPathById(marineLicenceId.toHexString())
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/zip')
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="Download CSV.zip"'
    )

    const firstLine = csvFromLastZip().split('\n')[0]
    expect(firstLine).toBe(
      'Lat Degree,Lat Dec Min,Long Degree,Long Dec Min,objectid'
    )
  })

  test('returns CSV rows for a submitted marine licence', async () => {
    const mockSiteName = mockFileUploadSite.siteName

    await insertSubmittedMarineLicence()

    const response = await getServer().inject({
      method: 'GET',
      url: buildCoordinatesCsvPathById(marineLicenceId.toHexString())
    })

    expect(response.statusCode).toBe(200)

    const lines = csvFromLastZip().split('\n').filter(Boolean)
    expect(lines).toHaveLength(6)
    expect(lines[1]).toBe(`51,28.4981,1,4.561,1`)
    expect(lines[2]).toBe(`51,28.5581,1,4.561,1`)
    expect(lines[3]).toBe(`51,28.5581,1,4.621,1`)
    expect(lines[4]).toBe(`51,28.4981,1,4.621,1`)
    expect(lines[5]).toBe(`51,28.4981,1,4.561,1`)
    expect(addFile).toHaveBeenCalledWith(
      `${mockSiteName}.csv`,
      expect.any(Buffer)
    )
  })

  test('returns a combined CSV plus one CSV per site for multiple sites', async () => {
    await insertSubmittedMarineLicence({
      siteDetails: [mockMultipleSite, mockCircleSite]
    })

    const response = await getServer().inject({
      method: 'GET',
      url: buildCoordinatesCsvPathById(marineLicenceId.toHexString())
    })

    expect(response.statusCode).toBe(200)
    expect(addFile).toHaveBeenCalledTimes(3)
    expect(addFile).toHaveBeenCalledWith('All_Sites.csv', expect.any(Buffer))
    expect(addFile).toHaveBeenCalledWith(
      `${mockMultipleSite.siteName}.csv`,
      expect.any(Buffer)
    )
    expect(addFile).toHaveBeenCalledWith(
      `${mockCircleSite.siteName}.csv`,
      expect.any(Buffer)
    )
  })

  test('returns 404 when the marine licence id is not found', async () => {
    const response = await getServer().inject({
      method: 'GET',
      url: buildCoordinatesCsvPathById(new ObjectId().toHexString())
    })

    expect(response.statusCode).toBe(404)
  })

  test('returns 400 when the marine licence id format is invalid', async () => {
    const response = await getServer().inject({
      method: 'GET',
      url: '/public/marine-licence/not-a-valid-id/generate-coordinates-csv'
    })

    expect(response.statusCode).toBe(400)
  })

  test('returns 403 when the marine licence is a draft', async () => {
    await insertSubmittedMarineLicence({
      status: MARINE_LICENCE_STATUS.DRAFT
    })

    const response = await getServer().inject({
      method: 'GET',
      url: buildCoordinatesCsvPathById(marineLicenceId.toHexString())
    })

    expect(response.statusCode).toBe(403)
  })

  test('returns 200 when the marine licence is active', async () => {
    await insertSubmittedMarineLicence({
      status: MARINE_LICENCE_STATUS.ACTIVE
    })

    const response = await getServer().inject({
      method: 'GET',
      url: buildCoordinatesCsvPathById(marineLicenceId.toHexString())
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/zip')
  })
})
