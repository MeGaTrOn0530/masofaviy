import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const apiRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  limit: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

export const createStrictRateLimiter = (limit = 20, windowMs = 60_000) => rateLimit({
  windowMs,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
});
