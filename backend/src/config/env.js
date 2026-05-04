import dotenv from 'dotenv';
import { buildDatabaseUrl } from '../utils/database-url.js';

dotenv.config();

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const requiredSecret = (name, fallback) => {
  const value = process.env[name] || fallback;
  if (!value || value.length < 8) {
    throw new Error(`${name} must be set and at least 8 characters long.`);
  }

  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseNumber(process.env.PORT, 4001),
  mysqlHost: process.env.MYSQL_HOST || '127.0.0.1',
  mysqlPort: parseNumber(process.env.MYSQL_PORT, 3306),
  mysqlDatabase: process.env.MYSQL_DATABASE || 'meeting_service',
  mysqlUser: process.env.MYSQL_USER || 'root',
  mysqlPassword: process.env.MYSQL_PASSWORD || '',
  mysqlSsl: process.env.MYSQL_SSL || '',
  databaseUrl: buildDatabaseUrl({
    databaseUrl: process.env.DATABASE_URL,
    mysqlHost: process.env.MYSQL_HOST,
    mysqlPort: process.env.MYSQL_PORT,
    mysqlDatabase: process.env.MYSQL_DATABASE,
    mysqlUser: process.env.MYSQL_USER,
    mysqlPassword: process.env.MYSQL_PASSWORD,
    mysqlSsl: process.env.MYSQL_SSL,
  }),
  jwtSecret: requiredSecret('JWT_SECRET', 'change-me-access-secret'),
  joinTokenSecret: requiredSecret('JOIN_TOKEN_SECRET', 'change-me-join-secret'),
  mainBackendMode: process.env.MAIN_BACKEND_MODE || 'mock',
  mainBackendUrl: process.env.MAIN_BACKEND_URL || 'http://localhost:3000',
  mainBackendAttendancePath: process.env.MAIN_BACKEND_ATTENDANCE_PATH || '/api/attendance/meeting',
  mainBackendEventPath: process.env.MAIN_BACKEND_EVENT_PATH || '/api/integrations/meeting-events',
  mainBackendServiceKey: process.env.MAIN_BACKEND_SERVICE_KEY || 'meeting-service-key',
  devAuthEnabled: parseBoolean(process.env.DEV_AUTH_ENABLED, true),
  devFileStoreFallback: parseBoolean(process.env.DEV_FILE_STORE_FALLBACK, process.env.NODE_ENV !== 'production'),
  fileStorePath: process.env.FILE_STORE_PATH || '.data/dev-store.json',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean),
  socketPath: process.env.SOCKET_PATH || '/socket.io',
  rateLimitWindowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMax: parseNumber(process.env.RATE_LIMIT_MAX, 120),
  attendanceSyncIntervalMs: parseNumber(process.env.ATTENDANCE_SYNC_INTERVAL_MS, 30_000),
  attendanceSyncMaxRetries: parseNumber(process.env.ATTENDANCE_SYNC_MAX_RETRIES, 10),
  mediasoupListenIp: process.env.MEDIASOUP_LISTEN_IP || '127.0.0.1',
  mediasoupMinPort: parseNumber(process.env.MEDIASOUP_MIN_PORT, 40_000),
  mediasoupMaxPort: parseNumber(process.env.MEDIASOUP_MAX_PORT, 49_999),
  mediasoupAnnouncedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '',
};
