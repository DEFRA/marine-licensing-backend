import { findAllExampleData, findExampleData } from './example-find.js';

describe('example-find module', () => {
  describe('findAllExampleData', () => {
    it('should return all example data from the "example-data" collection', async () => {
      const testData = [
        { exampleId: '1', name: 'Test Entity 1' },
        { exampleId: '2', name: 'Test Entity 2' }
      ];

      const toArrayMock = jest.fn().mockResolvedValue(testData);
      const findMock = jest.fn().mockReturnValue({ toArray: toArrayMock });
      const collectionMock = jest.fn().mockReturnValue({ find: findMock });

      const mockDb = { collection: collectionMock };

      const result = await findAllExampleData(mockDb);

      expect(collectionMock).toHaveBeenCalledWith('example-data');
      expect(findMock).toHaveBeenCalledWith({}, { projection: { _id: 0 } });
      expect(toArrayMock).toHaveBeenCalled();

      expect(result).toEqual(testData);
    });
  });

  describe('findExampleData', () => {
    it('should return the example data for a given exampleId', async () => {
      const testEntity = { exampleId: '1', name: 'Test Entity 1' };

      const findOneMock = jest.fn().mockResolvedValue(testEntity);
      const collectionMock = jest.fn().mockReturnValue({ findOne: findOneMock });

      const mockDb = { collection: collectionMock };

      const result = await findExampleData(mockDb, '1');

      expect(collectionMock).toHaveBeenCalledWith('example-data');
      expect(findOneMock).toHaveBeenCalledWith({ exampleId: '1' }, { projection: { _id: 0 } });

      expect(result).toEqual(testEntity);
    });
  });
});
