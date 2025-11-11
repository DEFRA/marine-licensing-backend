import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateCirclePolygon } from './circle-to-polygon.js'
import Circle from '@arcgis/core/geometry/Circle.js'

vi.mock('@arcgis/core/geometry/Circle.js', () => {
  return {
    default: vi.fn()
  }
})

describe('generateCirclePolygon', () => {
  const mockRings = [
    [
      [-1.0, 50.0],
      [-1.0, 50.001],
      [-0.999, 50.001],
      [-0.999, 50.0],
      [-1.0, 50.0]
    ]
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    const mockCircleInstance = {
      rings: mockRings,
      clone: vi.fn()
    }
    mockCircleInstance.clone.mockReturnValue(mockCircleInstance)

    Circle.mockImplementation(() => mockCircleInstance)
  })

  it('creates a Circle with correct parameters', () => {
    const params = {
      latitude: 50.123456,
      longitude: -1.987654,
      radiusMetres: 100
    }

    generateCirclePolygon(params)

    expect(Circle).toHaveBeenCalledWith({
      center: [-1.987654, 50.123456],
      radius: 100,
      geodesic: true
    })
  })

  it('returns the first ring from the circle geometry', () => {
    const params = {
      latitude: 51.5,
      longitude: -0.1,
      radiusMetres: 50
    }

    const result = generateCirclePolygon(params)

    expect(result).toEqual(mockRings[0])
  })

  it('handles different radius values', () => {
    const params = {
      latitude: 55.019889,
      longitude: -1.3995,
      radiusMetres: 25
    }

    generateCirclePolygon(params)

    expect(Circle).toHaveBeenCalledWith({
      center: [-1.3995, 55.019889],
      radius: 25,
      geodesic: true
    })
  })

  it('passes longitude and latitude in correct order to center array', () => {
    const params = {
      latitude: 52.0,
      longitude: 1.5,
      radiusMetres: 75
    }

    generateCirclePolygon(params)

    const callArgs = Circle.mock.calls[0][0]
    expect(callArgs.center).toEqual([1.5, 52.0])
    expect(callArgs.center[0]).toBe(params.longitude)
    expect(callArgs.center[1]).toBe(params.latitude)
  })
})
