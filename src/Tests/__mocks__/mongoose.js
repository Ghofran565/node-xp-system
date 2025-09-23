// Tests/__mocks__/mongoose.js
import { jest } from '@jest/globals';

const mongoose = {
  connect: jest.fn().mockResolvedValue({
    connection: { db: { databaseName: 'test-xp-system' } },
  }),
  disconnect: jest.fn().mockResolvedValue(true),
  connection: {
    db: {
      collections: jest.fn().mockResolvedValue([]),
      collection: jest.fn().mockReturnValue({
        deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
        insertMany: jest.fn().mockImplementation(docs => Promise.resolve(docs)),
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
        create: jest.fn().mockImplementation(doc => Promise.resolve(doc)),
      }),
    },
  },
  Schema: jest.fn().mockImplementation(() => ({
    pre: jest.fn(),
    post: jest.fn(),
  })),
  model: jest.fn().mockImplementation((name, schema) => {
    const model = function (doc) {
      return { ...doc, save: jest.fn().mockResolvedValue(doc) };
    };
    model.find = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
    model.findOne = jest.fn().mockResolvedValue(null);
    model.create = jest.fn().mockImplementation(doc => Promise.resolve(doc));
    model.updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    model.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
    model.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
    model.insertMany = jest.fn().mockImplementation(docs => Promise.resolve(docs));
    return model;
  }),
  Types: {
    ObjectId: jest.fn().mockImplementation(id => ({
      toString: jest.fn().mockReturnValue(id || 'mockObjectId'),
      equals: jest.fn().mockReturnValue(true),
    })),
  },
};

// Export as default to match `import mongoose from 'mongoose'`
export default mongoose;