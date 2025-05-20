import { MongoClient } from 'mongodb'
import { mongoDb } from './mongodb.js'

jest.mock('mongodb')
jest.mock('../../config', () => ({
  config: {
    get: jest.fn((key) => {
      if (key === 'mongoUri') {
        return 'mongodb://localhost:27017'
      } else if (key === 'mongoDatabase') {
        return 'test-db'
      }
      return null
    })
  }
}))

describe('MongoDB Plugin', () => {
  let server
  let mockDb
  let mockCollection
  let mockClient

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

    MongoClient.connect = jest.fn().mockResolvedValue(mockClient)

    server = {
      logger: {
        info: jest.fn()
      },
      decorate: jest.fn()
    }
  })

  it('should register the plugin successfully', async () => {
    await mongoDb.register(server)

    expect(MongoClient.connect).toHaveBeenCalledWith(
      'mongodb://localhost:27017',
      {
        retryWrites: false,
        readPreference: 'secondary'
      }
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

  it('should create indexes', async () => {
    await mongoDb.register(server)

    expect(mockDb.collection).toHaveBeenCalledWith('sites')
    expect(mockCollection.createIndex).toHaveBeenCalledWith({ id: 1 })
  })

  it('should pass secureContext if server has it', async () => {
    const secureContext = { some: 'secureContextObject' }
    server.secureContext = secureContext

    await mongoDb.register(server)

    expect(MongoClient.connect).toHaveBeenCalledWith(
      'mongodb://localhost:27017',
      {
        retryWrites: false,
        readPreference: 'secondary',
        secureContext
      }
    )
  })

  it('should validate plugin metadata', () => {
    expect(mongoDb.name).toBe('mongodb')
    expect(mongoDb.version).toBe('1.0.0')
  })
})
