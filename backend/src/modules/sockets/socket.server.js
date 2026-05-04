import { Server } from 'socket.io';
import { corsOptions } from '../../config/cors.js';
import { env } from '../../config/env.js';
import { socketAuthMiddleware } from './socket.auth.js';
import { registerMeetingSocketHandlers } from './meeting.socket.js';
import { roomManager } from '../media/room.manager.js';

export const createSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    path: env.socketPath,
    cors: corsOptions,
  });

  io.use(socketAuthMiddleware);
  io.on('connection', (socket) => {
    registerMeetingSocketHandlers(io, socket);
  });

  roomManager.attachSocketServer(io);
  return io;
};
