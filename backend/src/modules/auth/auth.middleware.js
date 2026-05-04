import { prisma } from '../../database/prisma.js';
import ApiError from '../../utils/ApiError.js';
import { mainBackendClient } from '../../integrations/main-backend.client.js';
import { verifyAccessToken } from './token.service.js';

const getBearerToken = (header) => {
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  return header.slice(7);
};

const syncUserSnapshot = async (user) => {
  await prisma.userSnapshot.upsert({
    where: {
      externalUserId: user.id,
    },
    create: {
      externalUserId: user.id,
      fullName: user.fullName,
      role: user.role,
      groupId: user.groupId,
    },
    update: {
      fullName: user.fullName,
      role: user.role,
      groupId: user.groupId,
    },
  });
};

export const authenticateRequest = async (req, res, next) => {
  void res;

  try {
    const accessToken = getBearerToken(req.headers.authorization);
    if (!accessToken) {
      throw new ApiError(401, 'Authorization token is required.');
    }

    const decoded = verifyAccessToken(accessToken);
    const user = await mainBackendClient.getCurrentUser(accessToken, decoded);

    await syncUserSnapshot(user);

    req.authToken = accessToken;
    req.user = {
      ...user,
      permissions: {
        canManageMeeting: user.role === 'teacher' || user.role === 'admin',
      },
    };

    next();
  } catch (error) {
    next(new ApiError(401, error.message || 'Invalid access token.'));
  }
};

export const authorizeRoles = (...roles) => (req, res, next) => {
  void res;

  if (!req.user || !roles.includes(req.user.role)) {
    next(new ApiError(403, 'You are not allowed to perform this action.'));
    return;
  }

  next();
};
