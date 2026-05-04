import { mediasoupService } from './mediasoup.service.js';
import { Room } from './room.js';

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.io = null;
  }

  attachSocketServer(io) {
    this.io = io;
  }

  emitToRoom(meetingId, eventName, payload, exceptSocketId = null) {
    if (!this.io) {
      return;
    }

    const target = this.io.to(`meeting:${meetingId}`);
    if (exceptSocketId) {
      target.except(exceptSocketId).emit(eventName, payload);
      return;
    }

    target.emit(eventName, payload);
  }

  emitToSocket(socketId, eventName, payload) {
    this.io?.to(socketId).emit(eventName, payload);
  }

  disconnectSocket(socketId) {
    this.io?.sockets.sockets.get(socketId)?.disconnect(true);
  }

  async ensureRoom(meetingId) {
    const existingRoom = this.rooms.get(meetingId);
    if (existingRoom) {
      return existingRoom;
    }

    const worker = await mediasoupService.getWorker();
    const room = await new Room({
      meetingId,
      manager: this,
      worker,
    }).init();

    this.rooms.set(meetingId, room);
    return room;
  }

  getRoom(meetingId) {
    return this.rooms.get(meetingId) || null;
  }

  closeRoom(meetingId, { endedByUserId } = {}) {
    const room = this.getRoom(meetingId);
    if (!room) {
      return [];
    }

    this.emitToRoom(meetingId, 'meeting:ended', {
      meetingId,
      endedByUserId,
    });

    const snapshots = room.close();
    this.rooms.delete(meetingId);

    snapshots.forEach((participant) => {
      this.disconnectSocket(participant.socketId);
    });

    return snapshots;
  }
}

export const roomManager = new RoomManager();
