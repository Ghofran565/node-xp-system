// Tests/__mocks__/nodemailer.js
import { jest } from '@jest/globals';

const nodemailer = {
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockImplementation(options => {
      // Simulate email sending failure
      if (options.to === 'invalid@example.com') {
        return Promise.reject(new Error('Invalid recipient'));
      }
      return Promise.resolve({ messageId: 'mocked-email' });
    }),
  }),
};

// Export as default to match `import nodemailer from 'nodemailer'`
export default nodemailer;