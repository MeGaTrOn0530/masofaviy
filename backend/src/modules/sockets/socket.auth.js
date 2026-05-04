import ApiError from '../../utils/ApiError.js';
import { verifyJoinToken } from '../auth/token.service.js';

export const socketAuthMiddleware = (socket, next) => {
  try {
    const joinToken = socket.handshake.auth?.joinToken || socket.handshake.headers['x-join-token'];
    if (!joinToken) {
      throw new ApiError(401, 'Socket join token is required.');
    }

    const decoded = verifyJoinToken(joinToken);
    socket.data.joinAuth = decoded;
    next();
  } catch (error) {
    next(new Error(error.message || 'Socket authentication failed.'));
  }
};
