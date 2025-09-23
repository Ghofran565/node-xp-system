// Tests/__mocks__/redis.js
import { jest } from '@jest/globals';

const mockClient = {
  get: jest.fn().mockImplementation(key => {
    if (key === 'leaderboard:global') {
      return Promise.resolve(JSON.stringify([
        { playerId: 'mockPlayerId1', username: 'player1', totalXp: 1500 },
        { playerId: 'mockPlayerId2', username: 'mod1', totalXp: 3000 },
      ]));
    }
    if (key.startsWith('tasks:')) {
      return Promise.resolve(JSON.stringify([{ taskId: 'mockTaskId', title: 'Mock Task' }]));
    }
    return Promise.resolve(null); // Cache miss
  }),
  set: jest.fn().mockImplementation((key, value, ex, ttl) => Promise.resolve('OK')),
  del: jest.fn().mockResolvedValue(1),
  connect: jest.fn().mockResolvedValue(true),
  quit: jest.fn().mockResolvedValue(true),
  // Edge case: Simulate connection failure
  connectFailure: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
};

// Named export for createClient
export const createClient = jest.fn().mockReturnValue(mockClient);

// Mock default export to avoid breaking other imports
export default {
  createClient: mockClient,
};