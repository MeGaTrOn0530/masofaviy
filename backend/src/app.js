import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { corsOptions } from './config/cors.js';
import { apiRateLimiter } from './middlewares/rate-limit.middleware.js';
import meetingRoutes from './modules/meetings/meeting.routes.js';
import attendanceRoutes from './modules/attendance/attendance.routes.js';
import { env } from './config/env.js';
import devRoutes from './modules/dev/dev.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import swaggerRoutes from './docs/swagger.routes.js';

export const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(apiRateLimiter);

app.get('/health', (req, res) => {
  void req;

  res.json({
    success: true,
    service: 'meeting-backend',
    status: 'ok',
  });
});

app.use('/api', swaggerRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/internal/attendance', attendanceRoutes);

if (env.devAuthEnabled && env.mainBackendMode === 'mock') {
  app.use('/api/dev', devRoutes);
}

app.use(notFoundHandler);
app.use(errorHandler);
