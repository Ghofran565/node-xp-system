// jest.config.mjs
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), 'config.env') });

export default {
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'mjs', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  roots: ['<rootDir>/Tests'],
  testMatch: ['<rootDir>/Tests/**/*.test.js', '<rootDir>/Tests/**/*.spec.js'],
  setupFilesAfterEnv: ['<rootDir>/Tests/setup.mjs'],
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  coveragePathIgnorePatterns: ['/Tests/', '/Utilities/seed.js', '/node_modules/'],
  collectCoverageFrom: [
    'Controllers/**/*.js',
    'Middlewares/**/*.js',
    'Utilities/**/*.js',
    '!Utilities/seed.js',
  ],
  clearMocks: true,
  resetMocks: true,
  resetModules: true,
  verbose: true,
  testTimeout: 10000,
  globals: {
    'process.env': {
      PORT: process.env.PORT || '3000',
      DATABASE_URL: process.env.DATABASE_URL || 'mongodb://localhost:27017/db-xp-system',
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      EMAIL_USER: process.env.EMAIL_USER || 'officialtestemail02@gmail.com',
      EMAIL_PASS: process.env.EMAIL_PASS || 'hhut suix xdoy lbzp',
      JWT_SECRET: process.env.JWT_SECRET || 'your_jwt_secret_here',
      NODE_ENV: process.env.NODE_ENV || 'test',
      MAX_LIMIT_USER: process.env.MAX_LIMIT_USER || '50',
      MAX_LIMIT_ADMIN: process.env.MAX_LIMIT_ADMIN || '1000',
      MAX_LIMIT_MOD: process.env.MAX_LIMIT_MOD || '500',
      MAX_LIMIT_OWNER: process.env.MAX_LIMIT_OWNER || '10000',
      CACHE_TTL: process.env.CACHE_TTL || '600',
    },
  },
};