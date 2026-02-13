import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  database: {
    url: process.env.DATABASE_URL || 'postgresql://hotel:hotel@localhost:5432/openclaw_hotel',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '3600', 10),
  },

  rateLimits: {
    messagesPer10s: parseInt(process.env.RATE_LIMIT_MESSAGES_PER_10S || '10', 10),
    joinsPer60s: parseInt(process.env.RATE_LIMIT_JOINS_PER_60S || '5', 10),
    roomsPerHour: parseInt(process.env.RATE_LIMIT_ROOMS_PER_HOUR || '3', 10),
  },

  admin: {
    password: process.env.ADMIN_PASSWORD || 'admin',
  },

  logLevel: process.env.LOG_LEVEL || 'info',
} as const;
