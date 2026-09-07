import { describe, it, expect } from 'vitest'
import { geoParser } from './index.js'

// The upload journey posts to this path by name; a rename breaks it silently.
describe('geo-parser routes', () => {
  it('should expose the extract route at its published path', () => {
    expect(geoParser.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /geo-parser/extract'
    ])
  })

  it('should give every route a handler', () => {
    for (const route of geoParser) {
      expect(typeof route.handler).toBe('function')
    }
  })
})
