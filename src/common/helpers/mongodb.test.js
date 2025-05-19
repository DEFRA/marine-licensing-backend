import { Db, MongoClient } from 'mongodb'
import { LockManager } from 'mongo-locks'
import { createServer } from '../../server.js'

jest.mock('../../common/helpers/auth/defra-id.js', () => ({
  defraId: {
    plugin: {
      name: 'defra-id',
      register: async () => {}
    }
  }
}))

jest.mock('../../plugins/router.js', () => ({
  router: {
    plugin: {
      name: 'router',
      register: async () => {}
    }
  }
}))

jest.mock('../../config.js', () => ({
  config: {
    get: jest.fn((key) => {
      switch (key) {
        case 'env':
          return 'test'
        case 'mongo':
          return {
            uri: 'mongodb://localhost:27017',
            databaseName: 'marine-licensing-backend'
          }
        case 'host':
          return 'localhost'
        case 'port':
          return 3000
        case 'session.cache.engine':
          return 'memory'
        case 'session.cache.name':
          return 'session'
        case 'session.cache.ttl':
          return 3600
        case 'session.cookie.password':
          return 'abcdefghijklmnopqrstuvwxyz123456'
        case 'session.cookie.ttl':
          return 3600
        case 'log':
          return { isEnabled: false, redact: [] }
        default:
          return undefined
      }
    })
  }
}))

describe('#mongoDb', () => {
  let server

  describe('Set up', () => {
    beforeAll(async () => {
      process.env.NODE_ENV = 'test'
      server = await createServer()
      await server.initialize()
    })

    afterAll(async () => {
      if (server && typeof server.stop === 'function') {
        await server.stop({ timeout: 0 })
      }
    })

    test('Server should have expected MongoDb decorators', () => {
      expect(server.db).toBeInstanceOf(Db)
      expect(server.mongoClient).toBeInstanceOf(MongoClient)
      expect(server.locker).toBeInstanceOf(LockManager)
    })

    test('MongoDb should have expected database name', () => {
      expect(server.db.databaseName).toBe('marine-licensing-backend')
    })

    test('MongoDb should have expected namespace', () => {
      expect(server.db.namespace).toContain('marine-licensing-backend')
    })
  })

  describe('Shut down', () => {
    beforeAll(async () => {
      process.env.NODE_ENV = 'test'
      server = await createServer()
      await server.initialize()
    })

    test('Should close Mongo client on server stop', async () => {
      const closeSpy = jest.spyOn(server.mongoClient, 'close')
      await server.stop({ timeout: 0 })
      expect(closeSpy).toHaveBeenCalledWith(true)
    })
  })
})
