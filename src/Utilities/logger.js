import winston from 'winston'

const logger = winston.createLogger({
  transports: [
    new winston.transports.File({ filename: 'logs/app.log' }),
    new winston.transports.MongoDB({ db: process.env.MONGO_URI, collection: 'auditLogs' }),
  ],
});

module.exports = logger;