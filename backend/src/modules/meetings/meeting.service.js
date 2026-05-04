import { prisma } from '../../database/prisma.js';
import ApiError from '../../utils/ApiError.js';
import { signJoinToken } from '../auth/token.service.js';
import { mainBackendClient } from '../../integrations/main-backend.client.js';
import { attendanceService } from '../attendance/attendance.service.js';
import { roomManager } from '../media/room.manager.js';
import { logger } from '../../utils/logger.js';

const meetingInclude = {
  groups: true,
};

const isStaff = (user) => ['teacher', 'admin'].includes(user.role);

const normalizeMeeting = (meeting, user = null) => {
  const groupIds = meeting.groups.map((group) => group.groupId);
  const now = new Date();
  const canJoinNow = meeting.status === 'live' && now >= meeting.startTime && now <= new Date(meeting.endTime.getTime() + 60 * 60 * 1000);

  return {
    id: meeting.id,
    title: meeting.title,
    description: meeting.description,
    createdByUserId: meeting.createdByUserId,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    status: meeting.status,
    groupIds,
    settings: {
      allowCamera: meeting.allowCamera,
      allowMicrophone: meeting.allowMicrophone,
      allowScreenShare: meeting.allowScreenShare,
      allowChat: meeting.allowChat,
    },
    permissions: user ? buildJoinPermissions(user, meeting) : null,
    canJoinNow,
  };
};

const getMeetingGroupIds = (meeting) => meeting.groups.map((group) => group.groupId);

const hasTeacherAccess = (user, meeting) => {
  if (user.role !== 'teacher') {
    return false;
  }

  const meetingGroupIds = getMeetingGroupIds(meeting);
  return meeting.createdByUserId === user.id || meetingGroupIds.some((groupId) => user.teacherGroupIds.includes(groupId));
};

const safeSendMeetingEvent = async (type, payload) => {
  try {
    await mainBackendClient.sendMeetingEvent(type, payload);
  } catch (error) {
    logger.warn(`Main backend event delivery failed for ${type}.`, {
      error: error.message,
      payload,
    });
  }
};

const ensureMeetingAccess = (user, meeting) => {
  if (user.role === 'admin') {
    return;
  }

  if (user.role === 'teacher' && hasTeacherAccess(user, meeting)) {
    return;
  }

  if (user.role === 'student' && user.groupId && getMeetingGroupIds(meeting).includes(user.groupId)) {
    return;
  }

  throw new ApiError(403, 'You are not allowed to access this meeting.');
};

const ensureTeacherCanCreateForGroups = (user, groupIds) => {
  if (user.role === 'admin') {
    return;
  }

  if (user.role !== 'teacher') {
    throw new ApiError(403, 'Only teacher or admin can create meeting.');
  }

  const invalidGroupIds = groupIds.filter((groupId) => !user.teacherGroupIds.includes(groupId));
  if (invalidGroupIds.length > 0) {
    throw new ApiError(403, `Teacher is not assigned to groups: ${invalidGroupIds.join(', ')}`);
  }
};

export const buildJoinPermissions = (user, meeting) => {
  if (user.role === 'admin' || user.role === 'teacher') {
    return {
      allowCamera: true,
      allowMicrophone: true,
      allowScreenShare: true,
      allowChat: meeting.allowChat,
      canManageMeeting: true,
    };
  }

  return {
    allowCamera: meeting.allowCamera,
    allowMicrophone: meeting.allowMicrophone,
    allowScreenShare: meeting.allowScreenShare,
    allowChat: meeting.allowChat,
    canManageMeeting: false,
  };
};

export const meetingService = {
  async createMeeting(user, payload) {
    ensureTeacherCanCreateForGroups(user, payload.groupIds);

    const startTime = new Date(payload.startTime);
    const endTime = new Date(payload.endTime);

    if (endTime <= startTime) {
      throw new ApiError(400, 'endTime must be later than startTime.');
    }

    const meeting = await prisma.meeting.create({
      data: {
        title: payload.title,
        description: payload.description || null,
        createdByUserId: user.id,
        startTime,
        endTime,
        allowCamera: payload.settings.allowCamera,
        allowMicrophone: payload.settings.allowMicrophone,
        allowScreenShare: payload.settings.allowScreenShare,
        allowChat: payload.settings.allowChat,
        groups: {
          create: payload.groupIds.map((groupId) => ({
            groupId,
          })),
        },
      },
      include: meetingInclude,
    });

    return normalizeMeeting(meeting, user);
  },

  async getMyMeetings(user) {
    let meetings = [];

    if (user.role === 'admin') {
      meetings = await prisma.meeting.findMany({
        include: meetingInclude,
        orderBy: {
          startTime: 'desc',
        },
      });
    } else if (user.role === 'teacher') {
      meetings = await prisma.meeting.findMany({
        where: {
          OR: [
            {
              createdByUserId: user.id,
            },
            {
              groups: {
                some: {
                  groupId: {
                    in: user.teacherGroupIds,
                  },
                },
              },
            },
          ],
        },
        include: meetingInclude,
        orderBy: {
          startTime: 'desc',
        },
      });
    } else {
      meetings = await prisma.meeting.findMany({
        where: {
          groups: {
            some: {
              groupId: user.groupId,
            },
          },
        },
        include: meetingInclude,
        orderBy: {
          startTime: 'desc',
        },
      });
    }

    return meetings.map((meeting) => normalizeMeeting(meeting, user));
  },

  async getMeetingById(meetingId, user) {
    const meeting = await prisma.meeting.findUnique({
      where: {
        id: meetingId,
      },
      include: meetingInclude,
    });

    if (!meeting) {
      throw new ApiError(404, 'Meeting not found.');
    }

    ensureMeetingAccess(user, meeting);
    return normalizeMeeting(meeting, user);
  },

  async getMeetingEntity(meetingId) {
    const meeting = await prisma.meeting.findUnique({
      where: {
        id: meetingId,
      },
      include: meetingInclude,
    });

    if (!meeting) {
      throw new ApiError(404, 'Meeting not found.');
    }

    return meeting;
  },

  async startMeeting(meetingId, user) {
    const meeting = await this.getMeetingEntity(meetingId);
    ensureMeetingAccess(user, meeting);

    if (!isStaff(user)) {
      throw new ApiError(403, 'Only teacher or admin can start meeting.');
    }

    if (meeting.status === 'ended') {
      throw new ApiError(400, 'Meeting already ended.');
    }

    const updatedMeeting = await prisma.meeting.update({
      where: {
        id: meetingId,
      },
      data: {
        status: 'live',
      },
      include: meetingInclude,
    });

    await safeSendMeetingEvent('meeting.started', {
      meetingId,
      startedByUserId: user.id,
      startedAt: new Date().toISOString(),
    });

    return normalizeMeeting(updatedMeeting, user);
  },

  async endMeeting(meetingId, user) {
    const meeting = await this.getMeetingEntity(meetingId);
    ensureMeetingAccess(user, meeting);

    if (!isStaff(user)) {
      throw new ApiError(403, 'Only teacher or admin can end meeting.');
    }

    const updatedMeeting = await prisma.meeting.update({
      where: {
        id: meetingId,
      },
      data: {
        status: 'ended',
      },
      include: meetingInclude,
    });

    const removedParticipants = roomManager.closeRoom(meetingId, {
      endedByUserId: user.id,
    });

    for (const participant of removedParticipants) {
      if (participant.sessionId) {
        await attendanceService.markLeave({
          participantSessionId: participant.sessionId,
          status: 'left',
        });
      }
    }

    await attendanceService.closeActiveSessionsForMeeting(meetingId, 'left');
    await attendanceService.syncMeetingAttendance(meetingId);

    await safeSendMeetingEvent('meeting.ended', {
      meetingId,
      endedByUserId: user.id,
      endedAt: new Date().toISOString(),
    });

    return normalizeMeeting(updatedMeeting, user);
  },

  async createJoinToken(meetingId, user) {
    const meeting = await this.getMeetingEntity(meetingId);
    ensureMeetingAccess(user, meeting);

    if (meeting.status !== 'live') {
      throw new ApiError(400, 'Meeting is not live yet.');
    }

    const permissions = buildJoinPermissions(user, meeting);
    const token = signJoinToken({
      meetingId,
      userId: user.id,
      fullName: user.fullName,
      role: user.role,
      groupId: user.groupId,
      teacherGroupIds: user.teacherGroupIds || [],
      permissions,
    });

    return {
      token,
      meeting: normalizeMeeting(meeting, user),
      permissions,
      expiresIn: '5m',
    };
  },

  async getAttendance(meetingId, user, search = '') {
    const meeting = await this.getMeetingEntity(meetingId);
    ensureMeetingAccess(user, meeting);

    if (!isStaff(user)) {
      throw new ApiError(403, 'Only teacher or admin can see attendance.');
    }

    return attendanceService.listMeetingAttendance(meetingId, search);
  },

  async getMeetingForSocketJoin(meetingId, user) {
    const meeting = await this.getMeetingEntity(meetingId);
    ensureMeetingAccess(user, meeting);

    if (meeting.status !== 'live') {
      throw new ApiError(400, 'Meeting is not live.');
    }

    return meeting;
  },
};
