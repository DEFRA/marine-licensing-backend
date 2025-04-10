import { createServer } from '../server';

describe('Health Endpoint', () => {
  let server;
  beforeAll(async () => {
    server = await createServer();
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop({ timeout: 0 });
  });

  test('GET /health returns success message', async () => {
    const response = await server.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload).toEqual({ message: 'success' });
  });
});
