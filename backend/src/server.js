import http from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, isUsingFallbackStore, prisma } from './database/prisma.js';
import { logger } from './utils/logger.js';
import { createSocketServer } from './modules/sockets/socket.server.js';
import { startAttendanceSyncScheduler, stopAttendanceSyncScheduler } from './modules/attendance/attendance-sync.service.js';

const httpServer = http.createServer(app);

const maskDatabaseUrl = (databaseUrl) => databaseUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');

const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully.`);
  stopAttendanceSyncScheduler();
  await prisma.$disconnect();
  httpServer.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT').catch((error) => {
    logger.error('Graceful shutdown failed.', { error: error.message });
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM').catch((error) => {
    logger.error('Graceful shutdown failed.', { error: error.message });
    process.exit(1);
  });
});

const bootstrap = async () => {
  const connection = await connectDatabase();

  if (connection.mode === 'prisma') {
    logger.info('Prisma database connected.', {
      databaseUrl: maskDatabaseUrl(process.env.DATABASE_URL || env.databaseUrl),
    });
  } else {
    logger.warn('Primary database unavailable. Using local file store fallback.', {
      fileStorePath: env.fileStorePath,
      reason: connection.error.message,
    });
  }

  createSocketServer(httpServer);
  startAttendanceSyncScheduler();

  httpServer.listen(env.port, () => {
    logger.info(`Meeting backend is running on port ${env.port}.`, {
      storageMode: isUsingFallbackStore() ? 'file-store' : 'mysql',
    });
  });
};

bootstrap().catch((error) => {
  logger.error('Server startup failed.', {
    error: error.message,
  });
  process.exit(1);
});
