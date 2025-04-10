import Boom from '@hapi/boom'
import { example } from '../routes/example.js'
import * as exampleFind from '../example-find.js'

describe('Example Routes', () => {
  describe('GET /example', () => {
    it('should return success with entities from findAllExampleData', async () => {
      const fakeEntities = [
        { exampleId: '1', name: 'Test Entity 1' },
        { exampleId: '2', name: 'Test Entity 2' }
      ]
      jest
        .spyOn(exampleFind, 'findAllExampleData')
        .mockResolvedValue(fakeEntities)
      const req = { db: {} }
      const h = { response: jest.fn((result) => result) }
      const route = example[0]
      const result = await route.handler(req, h)
      expect(result).toEqual({ message: 'success', entities: fakeEntities })
      expect(h.response).toHaveBeenCalledWith({
        message: 'success',
        entities: fakeEntities
      })
    })
  })

  describe('GET /example/{exampleId}', () => {
    it('should return success with the entity if found', async () => {
      const fakeEntity = { exampleId: '1', name: 'Entity 1' }
      jest.spyOn(exampleFind, 'findExampleData').mockResolvedValue(fakeEntity)
      const req = { db: {}, params: { exampleId: '1' } }
      const h = { response: jest.fn((result) => result) }
      const route = example[1]
      const result = await route.handler(req, h)
      expect(result).toEqual({ message: 'success', entity: fakeEntity })
      expect(h.response).toHaveBeenCalledWith({
        message: 'success',
        entity: fakeEntity
      })
    })

    it('should return Boom.notFound when no entity is found', async () => {
      jest.spyOn(exampleFind, 'findExampleData').mockResolvedValue(null)
      const req = { db: {}, params: { exampleId: 'non-existent' } }
      const h = { response: jest.fn((result) => result) }
      const route = example[1]
      const result = await route.handler(req, h)
      expect(result).toEqual(Boom.notFound())
    })
  })
})
