// Tests/__mocks__/winston.js
import { jest } from '@jest/globals';

const winston = {
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
};

// Export as default to match `import winston from 'winston'`
export default winston;