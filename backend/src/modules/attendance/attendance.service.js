import { prisma } from '../../database/prisma.js';
import ApiError from '../../utils/ApiError.js';
import { queueAttendanceSync } from './attendance-sync.service.js';

const calculateSessionSeconds = (joinedAt, leftAt) => Math.max(1, Math.floor((leftAt.getTime() - joinedAt.getTime()) / 1000));
const toMinutes = (seconds) => Math.ceil(seconds / 60);
const toDurationLabel = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;

  return [hours, minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':');
};

export const attendanceService = {
  async markJoin({ meetingId, user }) {
    const joinedAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const participantSession = await tx.meetingParticipant.create({
        data: {
          meetingId,
          userId: user.id,
          role: user.role,
          fullName: user.fullName,
          groupId: user.groupId,
          joinedAt,
          status: 'active',
        },
      });

      const existingAttendance = await tx.attendance.findUnique({
        where: {
          meetingId_userId: {
            meetingId,
            userId: user.id,
          },
        },
      });

      let attendanceRecord;
      if (!existingAttendance) {
        attendanceRecord = await tx.attendance.create({
          data: {
            meetingId,
            userId: user.id,
            groupId: user.groupId,
            fullName: user.fullName,
            firstJoinedAt: joinedAt,
            isPresent: true,
            syncedToMainBackend: false,
          },
        });
      } else {
        attendanceRecord = await tx.attendance.update({
          where: {
            id: existingAttendance.id,
          },
          data: {
            fullName: user.fullName,
            groupId: user.groupId,
            firstJoinedAt: existingAttendance.firstJoinedAt && existingAttendance.firstJoinedAt < joinedAt
              ? existingAttendance.firstJoinedAt
              : joinedAt,
            isPresent: true,
            syncedToMainBackend: false,
          },
        });
      }

      return {
        participantSession,
        attendanceRecord,
      };
    });

    return result.participantSession;
  },

  async markLeave({ participantSessionId, status = 'left' }) {
    const participantSession = await prisma.meetingParticipant.findUnique({
      where: {
        id: participantSessionId,
      },
    });

    if (!participantSession) {
      throw new ApiError(404, 'Participant session not found.');
    }

    if (participantSession.leftAt) {
      return null;
    }

    const leftAt = new Date();
    const sessionSeconds = calculateSessionSeconds(participantSession.joinedAt, leftAt);

    const attendanceRecord = await prisma.$transaction(async (tx) => {
      await tx.meetingParticipant.update({
        where: {
          id: participantSessionId,
        },
        data: {
          leftAt,
          totalSeconds: sessionSeconds,
          status,
        },
      });

      const activeSessions = await tx.meetingParticipant.findMany({
        where: {
          meetingId: participantSession.meetingId,
          userId: participantSession.userId,
          leftAt: null,
        },
      });

      const existingAttendance = await tx.attendance.findUnique({
        where: {
          meetingId_userId: {
            meetingId: participantSession.meetingId,
            userId: participantSession.userId,
          },
        },
      });

      if (!existingAttendance) {
        throw new ApiError(404, 'Attendance record not found for participant.');
      }

      return tx.attendance.update({
        where: {
          id: existingAttendance.id,
        },
        data: {
          fullName: participantSession.fullName,
          groupId: participantSession.groupId,
          lastLeftAt: leftAt,
          totalSeconds: existingAttendance.totalSeconds + sessionSeconds,
          isPresent: activeSessions.length > 0,
          syncedToMainBackend: false,
        },
      });
    });

    await queueAttendanceSync(attendanceRecord);
    return attendanceRecord;
  },

  async listMeetingAttendance(meetingId, search = '') {
    const [attendanceRecords, participantSessions] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          meetingId,
        },
        orderBy: {
          fullName: 'asc',
        },
      }),
      prisma.meetingParticipant.findMany({
        where: {
          meetingId,
        },
        orderBy: {
          joinedAt: 'asc',
        },
      }),
    ]);

    const normalizedSearch = search.trim().toLowerCase();
    const filteredAttendance = normalizedSearch
      ? attendanceRecords.filter((record) => record.fullName.toLowerCase().includes(normalizedSearch))
      : attendanceRecords;

    return filteredAttendance.map((attendanceRecord) => {
      const sessions = participantSessions
        .filter((session) => session.userId === attendanceRecord.userId)
        .map((session) => ({
          sessionId: session.id,
          joinedAt: session.joinedAt,
          leftAt: session.leftAt,
          totalSeconds: session.totalSeconds,
          totalMinutes: toMinutes(session.totalSeconds),
          totalDurationLabel: toDurationLabel(session.totalSeconds),
          status: session.status,
        }));

      return {
        attendanceId: attendanceRecord.id,
        meetingId: attendanceRecord.meetingId,
        userId: attendanceRecord.userId,
        groupId: attendanceRecord.groupId,
        fullName: attendanceRecord.fullName,
        firstJoinedAt: attendanceRecord.firstJoinedAt,
        lastLeftAt: attendanceRecord.lastLeftAt,
        totalSeconds: attendanceRecord.totalSeconds,
        totalMinutes: toMinutes(attendanceRecord.totalSeconds),
        totalDurationLabel: toDurationLabel(attendanceRecord.totalSeconds),
        sessionCount: sessions.length,
        currentlyInMeeting: sessions.some((session) => session.status === 'active' && !session.leftAt),
        isPresent: attendanceRecord.isPresent,
        syncedToMainBackend: attendanceRecord.syncedToMainBackend,
        sessions,
      };
    });
  },

  async syncMeetingAttendance(meetingId) {
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        meetingId,
        syncedToMainBackend: false,
      },
    });

    for (const attendanceRecord of attendanceRecords) {
      await queueAttendanceSync(attendanceRecord);
    }

    return attendanceRecords.length;
  },

  async closeActiveSessionsForMeeting(meetingId, status = 'left') {
    const activeSessions = await prisma.meetingParticipant.findMany({
      where: {
        meetingId,
        leftAt: null,
      },
    });

    for (const session of activeSessions) {
      await this.markLeave({
        participantSessionId: session.id,
        status,
      });
    }

    return activeSessions.length;
  },
};
