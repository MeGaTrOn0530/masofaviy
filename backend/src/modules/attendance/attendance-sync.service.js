import { prisma } from '../../database/prisma.js';
import { mainBackendClient } from '../../integrations/main-backend.client.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let syncTimer = null;

const buildAttendancePayload = (attendanceRecord) => ({
  attendanceId: attendanceRecord.id,
  meetingId: attendanceRecord.meetingId,
  userId: attendanceRecord.userId,
  groupId: attendanceRecord.groupId,
  fullName: attendanceRecord.fullName,
  firstJoinedAt: attendanceRecord.firstJoinedAt,
  lastLeftAt: attendanceRecord.lastLeftAt,
  totalSeconds: attendanceRecord.totalSeconds,
  totalMinutes: Math.ceil(attendanceRecord.totalSeconds / 60),
  isPresent: attendanceRecord.isPresent,
});

const markAttendanceSynced = async (attendanceId) => {
  await prisma.attendance.update({
    where: {
      id: attendanceId,
    },
    data: {
      syncedToMainBackend: true,
    },
  });
};

const createQueueItem = async (attendanceRecord, errorMessage, retryCount = 1) => prisma.attendanceSyncQueue.create({
  data: {
    meetingId: attendanceRecord.meetingId,
    payload: buildAttendancePayload(attendanceRecord),
    status: 'pending',
    retryCount,
    lastError: errorMessage,
  },
});

export const queueAttendanceSync = async (attendanceRecord) => {
  try {
    const payload = buildAttendancePayload(attendanceRecord);
    await mainBackendClient.sendAttendance(payload);
    await markAttendanceSynced(attendanceRecord.id);
    return {
      queued: false,
      delivered: true,
    };
  } catch (error) {
    await createQueueItem(attendanceRecord, error.message);
    logger.warn('Attendance sync queued for retry.', {
      attendanceId: attendanceRecord.id,
      meetingId: attendanceRecord.meetingId,
      error: error.message,
    });
    return {
      queued: true,
      delivered: false,
    };
  }
};

const processQueueItem = async (queueItem) => {
  try {
    await mainBackendClient.sendAttendance(queueItem.payload);

    if (queueItem.payload?.attendanceId) {
      await markAttendanceSynced(Number(queueItem.payload.attendanceId));
    }

    await prisma.attendanceSyncQueue.update({
      where: {
        id: queueItem.id,
      },
      data: {
        status: 'success',
        lastError: null,
      },
    });
  } catch (error) {
    const nextRetryCount = queueItem.retryCount + 1;
    await prisma.attendanceSyncQueue.update({
      where: {
        id: queueItem.id,
      },
      data: {
        status: nextRetryCount >= env.attendanceSyncMaxRetries ? 'failed' : 'pending',
        retryCount: nextRetryCount,
        lastError: error.message,
      },
    });
  }
};

export const syncPendingAttendanceQueue = async () => {
  const queueItems = await prisma.attendanceSyncQueue.findMany({
    where: {
      status: {
        in: ['pending', 'failed'],
      },
      retryCount: {
        lt: env.attendanceSyncMaxRetries,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: 50,
  });

  for (const queueItem of queueItems) {
    await processQueueItem(queueItem);
  }

  return queueItems.length;
};

export const startAttendanceSyncScheduler = () => {
  if (syncTimer) {
    return;
  }

  syncTimer = setInterval(() => {
    syncPendingAttendanceQueue().catch((error) => {
      logger.error('Attendance sync scheduler failed.', {
        error: error.message,
      });
    });
  }, env.attendanceSyncIntervalMs);
};

export const stopAttendanceSyncScheduler = () => {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
};
