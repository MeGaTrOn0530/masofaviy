import ApiError from '../../utils/ApiError.js';
import { roomManager } from '../media/room.manager.js';
import { attendanceService } from '../attendance/attendance.service.js';
import { meetingService } from '../meetings/meeting.service.js';
import { chatService } from '../chat/chat.service.js';
import { mainBackendClient } from '../../integrations/main-backend.client.js';
import { logger } from '../../utils/logger.js';

const withAck = (socket, handler) => async (payloadOrAck, maybeAck) => {
  const payload = typeof payloadOrAck === 'function' ? {} : (payloadOrAck || {});
  const ack = typeof payloadOrAck === 'function'
    ? payloadOrAck
    : (typeof maybeAck === 'function' ? maybeAck : null);

  try {
    const result = await handler(payload);
    if (ack) {
      ack({ success: true, data: result });
    }
  } catch (error) {
    socket.emit('error', {
      message: error.message || 'Socket action failed.',
      details: error.details || null,
    });

    if (ack) {
      ack({
        success: false,
        error: error.message || 'Socket action failed.',
      });
    }
  }
};

const assertTeacherControl = (socket) => {
  if (!socket.data.joinAuth?.permissions?.canManageMeeting) {
    throw new ApiError(403, 'Only teacher or admin can use this action.');
  }
};

const ensureJoined = (socket) => {
  if (!socket.data.meetingJoined) {
    throw new ApiError(400, 'You must join the meeting first.');
  }
};

const buildParticipantJoinedPayload = (participant) => ({
  userId: participant.userId,
  fullName: participant.fullName,
  role: participant.role,
  groupId: participant.groupId,
});

const canProduceMedia = (permissions, source) => {

  if (source === 'camera') {
    return permissions.allowCamera;
  }

  if (source === 'microphone' || source === 'audio') {
    return permissions.allowMicrophone;
  }

  if (source === 'screen') {
    return permissions.allowScreenShare;
  }

  return true;
};

const safeSendSocketEvent = async (type, payload) => {
  try {
    await mainBackendClient.sendMeetingEvent(type, payload);
  } catch (error) {
    logger.warn(`Main backend socket event delivery failed for ${type}.`, {
      error: error.message,
      payload,
    });
  }
};

export const registerMeetingSocketHandlers = (io, socket) => {
  void io;

  const leaveMeeting = async (status = 'left') => {
    if (!socket.data.meetingJoined || socket.data.cleanupInProgress) {
      return;
    }

    socket.data.cleanupInProgress = true;

    const meetingId = socket.data.joinAuth.meetingId;
    const room = roomManager.getRoom(meetingId);
    const participant = room?.removeParticipant(socket.id);

    if (participant?.sessionId) {
      try {
        await attendanceService.markLeave({
          participantSessionId: participant.sessionId,
          status,
        });
      } catch (error) {
        socket.emit('error', {
          message: error.message,
        });
      }
    }

    if (participant) {
      roomManager.emitToRoom(meetingId, 'participant:left', {
        ...buildParticipantJoinedPayload(participant),
        status,
      });

      await safeSendSocketEvent('participant.left', {
        meetingId,
        userId: participant.userId,
        role: participant.role,
        leftAt: new Date().toISOString(),
      });
    }

    socket.leave(`meeting:${meetingId}`);
    socket.emit('meeting:left', {
      meetingId,
      status,
    });

    socket.data.meetingJoined = false;
    socket.data.cleanupInProgress = false;
    socket.data.sessionId = null;
  };

  socket.on('meeting:join', withAck(socket, async () => {
    if (socket.data.meetingJoined) {
      return {
        alreadyJoined: true,
      };
    }

    const authUser = socket.data.joinAuth;
    const meeting = await meetingService.getMeetingForSocketJoin(authUser.meetingId, authUser);
    const room = await roomManager.ensureRoom(authUser.meetingId);

    const participantSession = await attendanceService.markJoin({
      meetingId: authUser.meetingId,
      user: {
        id: authUser.userId,
        fullName: authUser.fullName,
        role: authUser.role,
        groupId: authUser.groupId,
      },
    });

    let participant;
    try {
      participant = room.addParticipant({
        socketId: socket.id,
        sessionId: participantSession.id,
        userId: authUser.userId,
        fullName: authUser.fullName,
        role: authUser.role,
        groupId: authUser.groupId,
        permissions: authUser.permissions,
      });
    } catch (error) {
      await attendanceService.markLeave({
        participantSessionId: participantSession.id,
        status: 'left',
      });
      throw error;
    }

    socket.join(`meeting:${authUser.meetingId}`);
    socket.data.meetingJoined = true;
    socket.data.sessionId = participant.sessionId;

    const response = {
      meeting: {
        id: meeting.id,
        title: meeting.title,
        description: meeting.description,
        status: meeting.status,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        settings: {
          allowCamera: meeting.allowCamera,
          allowMicrophone: meeting.allowMicrophone,
          allowScreenShare: meeting.allowScreenShare,
          allowChat: meeting.allowChat,
        },
      },
      permissions: authUser.permissions,
      participants: room.listParticipants(),
      producers: room.listProducerSummaries(socket.id),
      messages: await chatService.getRecentMessages(authUser.meetingId),
    };

    socket.emit('meeting:joined', response);
    roomManager.emitToRoom(authUser.meetingId, 'participant:joined', buildParticipantJoinedPayload(participant), socket.id);

    await safeSendSocketEvent('participant.joined', {
      meetingId: authUser.meetingId,
      userId: authUser.userId,
      role: authUser.role,
      joinedAt: new Date().toISOString(),
    });

    return response;
  }));

  socket.on('meeting:leave', withAck(socket, async () => {
    await leaveMeeting('left');
    return {
      left: true,
    };
  }));

  socket.on('media:getRouterRtpCapabilities', withAck(socket, async () => {
    ensureJoined(socket);
    const room = roomManager.getRoom(socket.data.joinAuth.meetingId);
    return room?.router?.rtpCapabilities;
  }));

  socket.on('media:createWebRtcTransport', withAck(socket, async (payload) => {
    ensureJoined(socket);
    const room = roomManager.getRoom(socket.data.joinAuth.meetingId);
    return room.createWebRtcTransport(socket.id, payload.direction || 'send');
  }));

  socket.on('media:connectTransport', withAck(socket, async (payload) => {
    ensureJoined(socket);
    const room = roomManager.getRoom(socket.data.joinAuth.meetingId);
    return room.connectTransport(socket.id, payload.transportId, payload.dtlsParameters);
  }));

  socket.on('media:produce', withAck(socket, async (payload) => {
    ensureJoined(socket);

    const source = payload.appData?.source || payload.kind;
    const room = roomManager.getRoom(socket.data.joinAuth.meetingId);
    const livePermissions = room?.getParticipant(socket.id)?.permissions || socket.data.joinAuth.permissions;
    if (!canProduceMedia(livePermissions, source)) {
      throw new ApiError(403, `Permission denied for ${source}.`);
    }

    return room.produce(socket.id, payload);
  }));

  socket.on('media:closeProducer', withAck(socket, async (payload) => {
    ensureJoined(socket);
    const room = roomManager.getRoom(socket.data.joinAuth.meetingId);
    return room.closeProducer(socket.id, payload.producerId);
  }));

  socket.on('media:consume', withAck(socket, async (payload) => {
    ensureJoined(socket);
    const room = roomManager.getRoom(socket.data.joinAuth.meetingId);
    return room.consume(socket.id, payload);
  }));

  socket.on('media:resumeConsumer', withAck(socket, async (payload) => {
    ensureJoined(socket);
    const room = roomManager.getRoom(socket.data.joinAuth.meetingId);
    return room.resumeConsumer(socket.id, payload.consumerId);
  }));

  socket.on('chat:send', withAck(socket, async (payload) => {
    ensureJoined(socket);
    if (!socket.data.joinAuth.permissions.allowChat) {
      throw new ApiError(403, 'Chat is disabled for this meeting.');
    }

    const messageText = String(payload.message || '').trim();
    if (!messageText || messageText.length > 1000) {
      throw new ApiError(400, 'Message must be between 1 and 1000 characters.');
    }

    const savedMessage = await chatService.createMessage({
      meetingId: socket.data.joinAuth.meetingId,
      userId: socket.data.joinAuth.userId,
      fullName: socket.data.joinAuth.fullName,
      message: messageText,
    });

    roomManager.emitToRoom(socket.data.joinAuth.meetingId, 'chat:newMessage', savedMessage);
    return savedMessage;
  }));

  socket.on('teacher:muteUser', withAck(socket, async (payload) => {
    ensureJoined(socket);
    assertTeacherControl(socket);

    const room = roomManager.getRoom(socket.data.joinAuth.meetingId);
    room.closeParticipantMedia(payload.userId, (producerEntry) => producerEntry.kind === 'audio' || producerEntry.source === 'microphone');

    roomManager.emitToRoom(socket.data.joinAuth.meetingId, 'teacher:userMuted', {
      userId: Number(payload.userId),
      kind: 'audio',
      temporary: true,
    });

    return {
      muted: true,
    };
  }));

  socket.on('teacher:disableMicrophone', withAck(socket, async (payload) => {
    ensureJoined(socket);
    assertTeacherControl(socket);

    const room = roomManager.getRoom(socket.data.joinAuth.meetingId);
    room.closeParticipantMedia(payload.userId, (producerEntry) => producerEntry.kind === 'audio' || producerEntry.source === 'microphone');
    const permissions = room.updateParticipantPermissions(payload.userId, {
      allowMicrophone: false,
    });

    roomManager.emitToRoom(socket.data.joinAuth.meetingId, 'teacher:userMuted', {
      userId: Number(payload.userId),
      kind: 'audio',
      temporary: false,
    });

    return {
      permissions,
    };
  }));

  socket.on('teacher:disableCamera', withAck(socket, async (payload) => {
    ensureJoined(socket);
    assertTeacherControl(socket);

    const room = roomManager.getRoom(socket.data.joinAuth.meetingId);
    room.closeParticipantMedia(payload.userId, (producerEntry) => producerEntry.kind === 'video' && producerEntry.source === 'camera');
    const permissions = room.updateParticipantPermissions(payload.userId, {
      allowCamera: false,
    });

    roomManager.emitToRoom(socket.data.joinAuth.meetingId, 'teacher:userMuted', {
      userId: Number(payload.userId),
      kind: 'video',
      temporary: false,
    });

    return {
      permissions,
    };
  }));

  socket.on('teacher:allowScreenShare', withAck(socket, async (payload) => {
    ensureJoined(socket);
    assertTeacherControl(socket);

    const room = roomManager.getRoom(socket.data.joinAuth.meetingId);
    const permissions = room.updateParticipantPermissions(payload.userId, {
      allowScreenShare: Boolean(payload.allowed),
    });

    return {
      permissions,
    };
  }));

  socket.on('teacher:removeUser', withAck(socket, async (payload) => {
    ensureJoined(socket);
    assertTeacherControl(socket);

    const room = roomManager.getRoom(socket.data.joinAuth.meetingId);
    const targetParticipant = room?.getTargetParticipant(payload.userId);
    if (!targetParticipant) {
      throw new ApiError(404, 'Target participant not found.');
    }

    roomManager.emitToSocket(targetParticipant.socketId, 'teacher:userRemoved', {
      userId: targetParticipant.userId,
      meetingId: socket.data.joinAuth.meetingId,
    });

    const removedParticipant = room.removeParticipant(targetParticipant.socketId);

    if (removedParticipant?.sessionId) {
      await attendanceService.markLeave({
        participantSessionId: removedParticipant.sessionId,
        status: 'removed',
      });
    }

    roomManager.emitToRoom(socket.data.joinAuth.meetingId, 'participant:left', {
      ...buildParticipantJoinedPayload(removedParticipant),
      status: 'removed',
    });

    await safeSendSocketEvent('participant.left', {
      meetingId: socket.data.joinAuth.meetingId,
      userId: removedParticipant.userId,
      role: removedParticipant.role,
      leftAt: new Date().toISOString(),
      status: 'removed',
    });

    roomManager.disconnectSocket(targetParticipant.socketId);

    return {
      removed: true,
    };
  }));

  socket.on('disconnect', async () => {
    await leaveMeeting('disconnected');
  });
};
