import Hapi from '@hapi/hapi'
import { health } from '../../src/routes/health.js'

jest.mock('@hapi/jwt', () => ({
  __esModule: true,
  token: {
    decode: () => ({ decoded: { payload: {} } })
  }
}))

describe('health route', () => {
  let server

  beforeAll(async () => {
    server = Hapi.server()
    server.route(health)
    await server.initialize()
  })

  afterAll(async () => {
    if (server && typeof server.stop === 'function') {
      await server.stop({ timeout: 0 })
    }
  })

  it('returns 200 OK', async () => {
    const res = await server.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.result).toEqual({ message: 'success' })
  })
})
