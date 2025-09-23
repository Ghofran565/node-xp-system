// Tests/__mocks__/socket.io.js
import { jest } from '@jest/globals';

const mockServer = {
  emit: jest.fn().mockImplementation((event, data) => {
    if (event === 'playerUpdate') {
      return { event, data: { playerId: data.playerId, totalXp: data.totalXp } };
    }
    if (event === 'leaderboardUpdate') {
      return { event, data: { leaderboard: data.leaderboard } };
    }
  }),
  on: jest.fn(),
  to: jest.fn().mockReturnThis(),
};

// Named export for Server
export const Server = jest.fn().mockImplementation(() => mockServer);

// Mock default export to avoid breaking other imports
export default {
  Server: mockServer,
};