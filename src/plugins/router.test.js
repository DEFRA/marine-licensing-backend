import { router } from './router.js'
import { health } from '../routes/health.js'
import { example } from '../routes/example.js'
import { exemptions } from '../api/exemptions/index.js'

describe('router plugin', () => {
  let server

  beforeEach(() => {
    server = { route: jest.fn() }
  })

  it('registers all expected routes including the custom exemption route', () => {
    router.plugin.register(server, {})

    expect(server.route).toHaveBeenCalledTimes(1)
    const routes = server.route.mock.calls[0][0]
    expect(Array.isArray(routes)).toBe(true)

    expect(routes[0]).toBe(health)

    example.forEach((route) => {
      expect(routes).toContain(route)
    })

    exemptions.forEach((route) => {
      expect(routes).toContain(route)
    })

    // Custom route: GET /exemption/project-name with auth defra-id
    const custom = routes.find(
      (r) =>
        r.path === '/exemption/project-name' &&
        r.method === 'GET' &&
        r.options?.auth === 'defra-id'
    )
    expect(custom).toBeDefined()
    expect(typeof custom.handler).toBe('function')
  })

  it('custom exemption handler returns projectName and userEmail from request.auth.credentials.profile', async () => {
    router.plugin.register(server, {})
    const routes = server.route.mock.calls[0][0]
    const custom = routes.find(
      (r) =>
        r.path === '/exemption/project-name' && r.options?.auth === 'defra-id'
    )

    // Fake Hapi request context
    const fakeProfile = { email: 'dimitri@alpha.com' }
    const request = { auth: { credentials: { profile: fakeProfile } } }
    const h = { response: (payload) => payload }

    const result = await custom.handler(request, h)

    expect(result).toEqual({
      projectName: 'My Marine Exemption',
      userEmail: 'dimitri@alpha.com'
    })
  })
})
