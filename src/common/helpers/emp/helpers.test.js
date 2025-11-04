import { vi } from 'vitest'
import { makeEmpRequest } from './helpers.js'

describe('makeEmpRequest', () => {
  let mockFetch

  beforeEach(() => {
    mockFetch = vi.fn()
    globalThis.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should make a POST request to the correct URL', async () => {
    const mockResponse = { addResults: [{ objectId: 123 }] }
    mockFetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockResponse)
    })

    const features = [
      { geometry: { x: 1, y: 2 }, attributes: { name: 'Test' } }
    ]
    const apiUrl = 'https://api.example.com'
    const apiKey = 'test-api-key'

    await makeEmpRequest({ features, apiUrl, apiKey })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/addFeatures',
      expect.any(Object)
    )
  })

  it('should send correct headers', async () => {
    const mockResponse = { addResults: [] }
    mockFetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockResponse)
    })

    const features = []
    const apiUrl = 'https://api.example.com'
    const apiKey = 'test-key'

    await makeEmpRequest({ features, apiUrl, apiKey })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'content-type': 'application/x-www-form-urlencoded'
        }
      })
    )
  })

  it('should encode parameters correctly in the request body', async () => {
    const mockResponse = { success: true }
    mockFetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockResponse)
    })

    const features = [
      {
        geometry: { type: 'Point', coordinates: [1.5, 2.5] },
        attributes: { name: 'Site A' }
      }
    ]
    const apiUrl = 'https://api.example.com'
    const apiKey = 'my-secret-key'

    await makeEmpRequest({ features, apiUrl, apiKey })

    const callArgs = mockFetch.mock.calls[0][1]
    const bodyParams = callArgs.body

    expect(bodyParams.get('f')).toBe('json')
    expect(bodyParams.get('token')).toBe('my-secret-key')
    expect(bodyParams.get('features')).toBe(JSON.stringify(features))
  })

  it('should return both response and parsed data', async () => {
    const mockData = { addResults: [{ objectId: 456, success: true }] }
    const mockJsonFn = vi.fn().mockResolvedValue(mockData)
    const mockResponse = { json: mockJsonFn, status: 200 }
    mockFetch.mockResolvedValue(mockResponse)

    const features = [{ attributes: { id: 1 } }]
    const apiUrl = 'https://api.example.com'
    const apiKey = 'key123'

    const result = await makeEmpRequest({ features, apiUrl, apiKey })

    expect(result).toEqual({
      response: mockResponse,
      data: mockData
    })
    expect(mockJsonFn).toHaveBeenCalledTimes(1)
  })

  it('should handle empty features array', async () => {
    const mockResponse = { addResults: [] }
    mockFetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockResponse)
    })

    const result = await makeEmpRequest({
      features: [],
      apiUrl: 'https://api.example.com',
      apiKey: 'test-key'
    })

    expect(result.data).toEqual({ addResults: [] })
    expect(mockFetch).toHaveBeenCalled()
  })

  it('should handle multiple features', async () => {
    const mockResponse = {
      addResults: [{ objectId: 1 }, { objectId: 2 }, { objectId: 3 }]
    }
    mockFetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockResponse)
    })

    const features = [
      { attributes: { name: 'Feature 1' } },
      { attributes: { name: 'Feature 2' } },
      { attributes: { name: 'Feature 3' } }
    ]

    const result = await makeEmpRequest({
      features,
      apiUrl: 'https://api.example.com',
      apiKey: 'key'
    })

    expect(result.data.addResults).toHaveLength(3)
    const callArgs = mockFetch.mock.calls[0][1]
    expect(callArgs.body.get('features')).toBe(JSON.stringify(features))
  })

  it('should handle complex feature objects with nested data', async () => {
    const mockResponse = { success: true }
    mockFetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockResponse)
    })

    const features = [
      {
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0]
            ]
          ]
        },
        attributes: {
          name: 'Complex Site',
          metadata: {
            created: '2024-01-01',
            tags: ['tag1', 'tag2']
          }
        }
      }
    ]

    await makeEmpRequest({
      features,
      apiUrl: 'https://api.example.com',
      apiKey: 'key'
    })

    const callArgs = mockFetch.mock.calls[0][1]
    const sentFeatures = JSON.parse(callArgs.body.get('features'))
    expect(sentFeatures).toEqual(features)
  })

  it('should handle fetch errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const features = [{ attributes: { name: 'Test' } }]

    await expect(
      makeEmpRequest({
        features,
        apiUrl: 'https://api.example.com',
        apiKey: 'key'
      })
    ).rejects.toThrow('Network error')
  })

  it('should handle JSON parse errors', async () => {
    mockFetch.mockResolvedValue({
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
    })

    const features = [{ attributes: { name: 'Test' } }]

    await expect(
      makeEmpRequest({
        features,
        apiUrl: 'https://api.example.com',
        apiKey: 'key'
      })
    ).rejects.toThrow('Invalid JSON')
  })

  it('should construct URL correctly with trailing slash in apiUrl', async () => {
    const mockResponse = { success: true }
    mockFetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockResponse)
    })

    await makeEmpRequest({
      features: [],
      apiUrl: 'https://api.example.com/',
      apiKey: 'key'
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com//addFeatures',
      expect.any(Object)
    )
  })

  it('should handle different API keys', async () => {
    const mockResponse = { success: true }
    mockFetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockResponse)
    })

    const testCases = [
      'simple-key',
      'key-with-dashes',
      'key_with_underscores',
      'KeyWith123Numbers',
      'very-long-key-with-many-characters-1234567890'
    ]

    for (const apiKey of testCases) {
      mockFetch.mockClear()
      await makeEmpRequest({
        features: [],
        apiUrl: 'https://api.example.com',
        apiKey
      })

      const callArgs = mockFetch.mock.calls[0][1]
      expect(callArgs.body.get('token')).toBe(apiKey)
    }
  })

  it('should stringify features with special characters correctly', async () => {
    const mockResponse = { success: true }
    mockFetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockResponse)
    })

    const features = [
      {
        attributes: {
          name: 'Site with "quotes"',
          description: "Site with 'single quotes'",
          special: 'Characters: & = ? #'
        }
      }
    ]

    await makeEmpRequest({
      features,
      apiUrl: 'https://api.example.com',
      apiKey: 'key'
    })

    const callArgs = mockFetch.mock.calls[0][1]
    const sentFeatures = JSON.parse(callArgs.body.get('features'))
    expect(sentFeatures[0].attributes.name).toBe('Site with "quotes"')
    expect(sentFeatures[0].attributes.description).toBe(
      "Site with 'single quotes'"
    )
    expect(sentFeatures[0].attributes.special).toBe('Characters: & = ? #')
  })
})
