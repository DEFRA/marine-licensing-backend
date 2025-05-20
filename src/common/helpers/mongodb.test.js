import { MongoClient } from 'mongodb'
import { mongoDb } from './mongodb.js'

jest.mock('mongodb', () => ({
  MongoClient: {
    connect: jest.fn()
  }
}))

jest.mock('../../config.js', () => ({
  config: {
    get: jest.fn((key) => {
      if (key === 'mongo') {
        return {
          uri: 'mongodb://localhost:27017',
          databaseName: 'test-db'
        }
      }
      return undefined
    })
  }
}))

describe('MongoDB Plugin', () => {
  let server
  let mockClient
  let mockDb
  let mockCollection

  beforeEach(() => {
    jest.clearAllMocks()

    mockCollection = {
      createIndex: jest.fn().mockResolvedValue(true)
    }

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection)
    }

    mockClient = {
      db: jest.fn().mockReturnValue(mockDb)
    }

    MongoClient.connect.mockResolvedValue(mockClient)

    server = {
      logger: { info: jest.fn() },
      decorate: jest.fn()
    }
  })

  it('registers and decorates correctly', async () => {
    await mongoDb.register(server)

    expect(MongoClient.connect).toHaveBeenCalledWith(
      'mongodb://localhost:27017',
      { retryWrites: false, readPreference: 'secondary' }
    )

    expect(server.logger.info).toHaveBeenCalledWith('Setting up mongodb')
    expect(server.logger.info).toHaveBeenCalledWith(
      'mongodb connected to test-db'
    )

    expect(server.decorate).toHaveBeenCalledWith(
      'server',
      'mongoClient',
      mockClient
    )
    expect(server.decorate).toHaveBeenCalledWith('server', 'db', mockDb)
    expect(server.decorate).toHaveBeenCalledWith('request', 'db', mockDb)
  })

  it('creates the sites index', async () => {
    await mongoDb.register(server)

    expect(mockDb.collection).toHaveBeenCalledWith('sites')
    expect(mockCollection.createIndex).toHaveBeenCalledWith({ id: 1 })
  })

  it('passes secureContext through to the driver options', async () => {
    const secureContext = { foo: 'bar' }
    server.secureContext = secureContext

    await mongoDb.register(server)

    expect(MongoClient.connect).toHaveBeenCalledWith(
      'mongodb://localhost:27017',
      { retryWrites: false, readPreference: 'secondary', secureContext }
    )
  })

  it('exposes name and version metadata', () => {
    expect(mongoDb.name).toBe('mongodb')
    expect(mongoDb.version).toBe('1.0.0')
  })
})
