import { meetingService } from './meeting.service.js';

const withResponse = (serviceHandler) => async (req, res, next) => {
  try {
    const data = await serviceHandler(req);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const createMeeting = withResponse((req) => meetingService.createMeeting(req.user, req.body));
export const getMyMeetings = withResponse((req) => meetingService.getMyMeetings(req.user));
export const getMeetingById = withResponse((req) => meetingService.getMeetingById(Number(req.params.id), req.user));
export const startMeeting = withResponse((req) => meetingService.startMeeting(Number(req.params.id), req.user));
export const endMeeting = withResponse((req) => meetingService.endMeeting(Number(req.params.id), req.user));
export const createJoinToken = withResponse((req) => meetingService.createJoinToken(Number(req.params.id), req.user));
export const getMeetingAttendance = withResponse((req) => meetingService.getAttendance(Number(req.params.id), req.user, req.query.search || ''));
