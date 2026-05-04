import { Router } from 'express';
import ApiError from '../../utils/ApiError.js';
import { env } from '../../config/env.js';
import { createStrictRateLimiter } from '../../middlewares/rate-limit.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { attendanceSyncSchema } from '../meetings/meeting.validation.js';
import { attendanceService } from './attendance.service.js';
import { syncPendingAttendanceQueue } from './attendance-sync.service.js';

const router = Router();

const internalServiceAuth = (req, res, next) => {
  void res;

  const serviceKey = req.header('X-Internal-Service-Key');
  if (serviceKey !== env.mainBackendServiceKey) {
    next(new ApiError(401, 'Invalid internal service key.'));
    return;
  }

  next();
};

router.post(
  '/sync',
  createStrictRateLimiter(20, 60_000),
  internalServiceAuth,
  validate(attendanceSyncSchema),
  async (req, res, next) => {
    try {
      const meetingId = req.body?.meetingId;
      const syncedRecords = meetingId
        ? await attendanceService.syncMeetingAttendance(Number(meetingId))
        : await syncPendingAttendanceQueue();

      res.json({
        success: true,
        data: {
          syncedRecords,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
