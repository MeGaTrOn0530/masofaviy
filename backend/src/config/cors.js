import { env } from './env.js';

const isAllowedDevOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) {
      return false;
    }

    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin) || isAllowedDevOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Internal-Service-Key'],
};
