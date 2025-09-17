/**
 * Logger utility combining Winston with colorized console output, log levels, timestamps, and execution time tracking
 * @module logger
 */

import winston from 'winston';
import 'winston-mongodb';
import dotenv from 'dotenv';
import { __dirname } from '../app.js';

dotenv.config({ path: `${__dirname}/config.env`, silent: true });

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

// Colors for log level prefixes
const LEVEL_COLORS = {
  [LOG_LEVELS.DEBUG]: COLORS.magenta,
  [LOG_LEVELS.INFO]: COLORS.cyan,
  [LOG_LEVELS.WARN]: COLORS.yellow,
  [LOG_LEVELS.ERROR]: COLORS.red,
};

// Configure Winston transports
const transports = [
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ level, message, timestamp, color }) => {
        const prefixColor = LEVEL_COLORS[level] || COLORS.white;
        const messageColor = color || COLORS.white;
        return `${timestamp} ${prefixColor}[${level.toUpperCase()}]${COLORS.reset} ${messageColor}${message}${COLORS.reset}`;
      })
    ),
  }),
  new winston.transports.File({ filename: 'logs/app.log' }),
];

// Add MongoDB transport only if DATABASE_URL is set
if (process.env.DATABASE_URL) {
  transports.push(
    new winston.transports.MongoDB({
      db: process.env.DATABASE_URL,
      collection: 'auditLogs',
      level: 'info',
    })
  );
} else {
  console.warn(`${COLORS.yellow}[WARNING] DATABASE_URL not set. Skipping MongoDB logging.${COLORS.reset}`);
}

// Configure Winston logger
const logger = winston.createLogger({
  levels: winston.config.cli.levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => `${timestamp} [${level.toUpperCase()}] ${message}`)
  ),
  transports,
});

/**
 * Creates a log message with color and formatting options
 * @param {...any} args - Arguments to log
 * @returns {Object} Logger instance with color and background methods
 */
const createLogger = (...args) => {
  const timestamp = new Date().toISOString();
  let message = args
    .map(arg => (arg === undefined ? 'undefined' : typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
    .join(' ');

  // Prevent empty or undefined messages
  if (!message || message.trim() === 'undefined') {
    message = '[Empty Message]';
  }

  const logInstance = {
    level: LOG_LEVELS.INFO,
    withTimestamp: false,
    prefix: '',
    color: null,

    // Color methods
    ...Object.keys(COLORS).reduce((acc, color) => {
      acc[color] = function () {
        this.color = COLORS[color]; // Store the color for Winston
        const timePrefix = this.withTimestamp ? `[${timestamp}] ` : '';
        const levelPrefix = this.prefix || this.level.toUpperCase();
        const plainOutput = `${timePrefix}${message}`; // Exclude level prefix

        // Log to Winston (console, file, MongoDB)
        logger[this.level]({ message: plainOutput, color: this.color });

        // Add stack trace for ERROR level
        if (this.level === LOG_LEVELS.ERROR) {
          const stack = new Error().stack.split('\n').slice(2).join('\n');
          logger.error(stack);
        }

        // Log execution time if tracking
        if (this.startTime) {
          const duration = (performance.now() - this.startTime).toFixed(2);
          const timeMessage = `${timePrefix}[EXECUTION TIME] ${duration}ms`;
          logger[this.level]({ message: timeMessage, color: COLORS.cyan });
        }

        return this; // Enable chaining
      };
      return acc;
    }, {}),

    // Log level setters
    debug() {
      this.level = LOG_LEVELS.DEBUG;
      this.prefix = LOG_LEVELS.DEBUG.toUpperCase();
      return this;
    },

    info() {
      this.level = LOG_LEVELS.INFO;
      this.prefix = LOG_LEVELS.INFO.toUpperCase();
      return this;
    },

    warn() {
      this.level = LOG_LEVELS.WARN;
      this.prefix = LOG_LEVELS.WARN.toUpperCase();
      return this;
    },

    error() {
      this.level = LOG_LEVELS.ERROR;
      this.prefix = LOG_LEVELS.ERROR.toUpperCase();
      return this;
    },

    // Timestamp toggle
    addTimestamp() {
      this.withTimestamp = true;
      return this;
    },

    // Custom prefix
    setPrefix(prefix) {
      this.prefix = prefix;
      return this;
    },

    // Start execution time tracking
    startTimer() {
      this.startTime = performance.now();
      return this;
    },
  };

  return logInstance;
};

/**
 * Main log function for colorized console output
 * @param {...any} args - Arguments to log
 * @returns {Object} Logger instance
 */
export const log = (...args) => createLogger(...args);

// Export Winston logger for direct use
export { logger };

// Example usage:
/*
logger.info('Direct Winston log');
log('Redis connected').info().red(); // [INFO] in cyan, "Redis connected" in red
log('Error occurred').error().bgRed(); // [ERROR] in red, "Error occurred" in red background
log('Server is running on port 3000 :]').info().green(); // [INFO] in cyan, message in green
log('Processing...').addTimestamp().debug().green(); // [DEBUG] in green, message in green
log('Custom').setPrefix('API').blue(); // [API] in blue, message in blue
log('Operation').startTimer().warn().yellow(); // [WARN] in yellow, message in yellow
*/