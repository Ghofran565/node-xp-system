// Tests/__mocks__/express-validator.js
import { jest } from '@jest/globals';

export const validationResult = jest.fn().mockImplementation(() => ({
  isEmpty: jest.fn().mockReturnValue(true),
  array: jest.fn().mockReturnValue([]),
}));