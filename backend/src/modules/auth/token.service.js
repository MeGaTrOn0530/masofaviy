import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export const signAccessToken = (payload, expiresIn = '12h') => jwt.sign(payload, env.jwtSecret, { expiresIn });

export const verifyAccessToken = (token) => jwt.verify(token, env.jwtSecret);

export const signJoinToken = (payload) => jwt.sign(payload, env.joinTokenSecret, {
  expiresIn: '5m',
});

export const verifyJoinToken = (token) => jwt.verify(token, env.joinTokenSecret);
