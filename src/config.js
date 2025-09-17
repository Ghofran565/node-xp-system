// config.js
import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env file
config({ path: path.resolve(process.cwd(), 'config.env') });

// Security configuration for API features
export const securityConfig = {
  // Fields that should be excluded from query results for all roles
  forbiddenFields: [
    'password',          // Sensitive user data
    'email',             // Sensitive user data
    '__v',              // Mongoose version key
    'playerId',         // Internal ID, can be derived from _id
  ],

  // Access levels defining maximum result limits per user role
  accessLevels: {
    guest: {
      maxLimit: parseInt(process.env.MAX_LIMIT_GUEST || '20', 10), // Default 20
    },
    user: {
      maxLimit: parseInt(process.env.MAX_LIMIT_USER || '50', 10),  // Default 50
    },
    admin: {
      maxLimit: parseInt(process.env.MAX_LIMIT_ADMIN || '1000', 10), // Default 1000
    },
    mod: {
      maxLimit: parseInt(process.env.MAX_LIMIT_MOD || '500', 10),   // Default 500
    },
    owner: {
      maxLimit: parseInt(process.env.MAX_LIMIT_OWNER || '10000', 10), // Default 10000
    },
  },

  // Default settings for API behavior
  defaults: {
    page: 1,            // Default page number
    limit: 10,          // Default limit per page (overridden by role-based maxLimit)
  },

  // Cache configuration (assumed for consistency with your caching usage)
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '600', 10), // Default 10 minutes (600 seconds)
  },

  // Email configuration for notifications
//   email: {
//     adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com', // Default admin email
//     allPlayersEmail: process.env.ALL_PLAYERS_EMAIL || '',      // Broadcast email (optional)
//   },

  // API rate limiting (optional, can be expanded with a library like express-rate-limit)
//   rateLimit: {
//     windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
//     max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),              // 100 requests
//   },
// };

// // Export additional utility configurations
// export const appConfig = {
//   port: parseInt(process.env.PORT || '3000', 10), // Default port
//   env: process.env.NODE_ENV || 'development',     // Environment mode
//   baseUrl: process.env.BASE_URL || 'http://localhost:3000', // Base URL for links
// };

// Validate environment variables
// const requiredEnvVars = ['ADMIN_EMAIL'];
// requiredEnvVars.forEach((varName) => {
//   if (!process.env[varName]) {
//     console.warn(`Warning: ${varName} is not set in .env. Using default value.`);
//   }
//});
};