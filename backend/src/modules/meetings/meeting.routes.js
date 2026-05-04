import { Router } from 'express';
import { authenticateRequest } from '../auth/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createStrictRateLimiter } from '../../middlewares/rate-limit.middleware.js';
import {
  createMeetingSchema,
  meetingIdParamSchema,
} from './meeting.validation.js';
import {
  createMeeting,
  getMyMeetings,
  getMeetingById,
  startMeeting,
  endMeeting,
  createJoinToken,
  getMeetingAttendance,
} from './meeting.controller.js';

const router = Router();

router.use(authenticateRequest);

router.post('/', validate(createMeetingSchema), createMeeting);
router.get('/my', getMyMeetings);
router.get('/:id', validate(meetingIdParamSchema), getMeetingById);
router.post('/:id/start', validate(meetingIdParamSchema), startMeeting);
router.post('/:id/end', validate(meetingIdParamSchema), endMeeting);
router.post('/:id/join-token', createStrictRateLimiter(30, 60_000), validate(meetingIdParamSchema), createJoinToken);
router.get('/:id/attendance', validate(meetingIdParamSchema), getMeetingAttendance);

export default router;
