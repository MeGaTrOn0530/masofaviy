import { Router } from 'express';
import ApiError from '../../utils/ApiError.js';
import { mainBackendClient } from '../../integrations/main-backend.client.js';
import { signAccessToken } from '../auth/token.service.js';

const router = Router();

router.get('/users', (req, res) => {
  void req;

  res.json({
    success: true,
    data: mainBackendClient.listMockUsers(),
  });
});

router.post('/token', (req, res, next) => {
  try {
    const userId = Number(req.body?.userId);
    const user = mainBackendClient.listMockUsers().find((item) => item.id === userId);

    if (!user) {
      throw new ApiError(404, 'Mock user not found.');
    }

    const token = signAccessToken({
      userId: user.id,
      role: user.role,
    });

    res.json({
      success: true,
      data: {
        token,
        user,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
