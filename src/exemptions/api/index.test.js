import { describe, it, expect } from 'vitest'
import { exemptions } from './index.js'

// The frontend and MAS gateway call these paths by name, so a rename is a
// breaking API change rather than a refactor. This pins the public surface.
describe('exemption routes', () => {
  const routeTable = () =>
    exemptions.map(({ method, path }) => `${method} ${path}`)

  // Compared as a sorted set: the routes registered are the contract, the order
  // they appear in the array is not, so adding a route mid-list should not fail
  // this test.
  it('should expose the expected method and path for every exemption route', () => {
    expect(routeTable().sort()).toEqual(
      [
        'GET /exemption/{id}',
        'GET /public/exemption/{id}',
        'GET /exemptions/send-to-emp',
        'GET /exemptions/backfill-areas',
        'GET /exemptions/summary',
        'POST /exemption/project-name',
        'PATCH /exemption/project-name',
        'PATCH /exemption/public-register',
        'PATCH /exemption/site-details',
        'POST /exemption/submit',
        'POST /exemption/send-to-emp',
        'POST /exemption/backfill-areas',
        'DELETE /exemption/{id}',
        'POST /exemption/{id}/withdraw'
      ].sort()
    )
  })

  it('should give every route a handler', () => {
    for (const route of exemptions) {
      expect(typeof route.handler).toBe('function')
    }
  })

  it('should not register the same method and path twice', () => {
    const table = routeTable()
    expect(new Set(table).size).toBe(table.length)
  })

  it('should only expose the public prefix on routes intended to be unauthenticated', () => {
    const publicRoutes = exemptions
      .filter(({ path }) => path.startsWith('/public/'))
      .map(({ path }) => path)

    expect(publicRoutes).toEqual(['/public/exemption/{id}'])
  })
})
