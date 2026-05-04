import ApiError from '../../utils/ApiError.js';
import { mediasoupConfig } from '../../config/mediasoup.js';
import { Participant } from './participant.js';

const studentRoles = new Set(['student']);
const teacherRoles = new Set(['teacher', 'admin']);

export class Room {
  constructor({ meetingId, manager, worker }) {
    this.meetingId = meetingId;
    this.manager = manager;
    this.worker = worker;
    this.router = null;
    this.participants = new Map();
  }

  async init() {
    this.router = await this.worker.createRouter(mediasoupConfig.router);
    return this;
  }

  get roomName() {
    return `meeting:${this.meetingId}`;
  }

  getParticipant(socketId) {
    return this.participants.get(socketId);
  }

  getParticipantsByUserId(userId) {
    return [...this.participants.values()].filter((participant) => participant.userId === Number(userId));
  }

  countParticipantsByRole() {
    let students = 0;
    let teachers = 0;

    for (const participant of this.participants.values()) {
      if (studentRoles.has(participant.role)) {
        students += 1;
      }

      if (teacherRoles.has(participant.role)) {
        teachers += 1;
      }
    }

    return {
      students,
      teachers,
      total: this.participants.size,
    };
  }

  addParticipant(meta) {
    const counts = this.countParticipantsByRole();

    if (studentRoles.has(meta.role) && counts.students >= 30) {
      throw new ApiError(400, 'Student capacity reached for this room.');
    }

    if (teacherRoles.has(meta.role) && counts.teachers >= 3) {
      throw new ApiError(400, 'Teacher capacity reached for this room.');
    }

    if (counts.total >= 33) {
      throw new ApiError(400, 'Room capacity reached.');
    }

    const participant = new Participant(meta);
    this.participants.set(meta.socketId, participant);
    return participant;
  }

  removeParticipant(socketId) {
    const participant = this.participants.get(socketId);
    if (!participant) {
      return null;
    }

    participant.closeAll();
    this.participants.delete(socketId);

    return {
      socketId: participant.socketId,
      sessionId: participant.sessionId,
      userId: participant.userId,
      fullName: participant.fullName,
      role: participant.role,
      groupId: participant.groupId,
    };
  }

  listParticipants() {
    return [...this.participants.values()].map((participant) => participant.toPublicJSON());
  }

  listProducerSummaries(excludeSocketId = null) {
    const producers = [];

    for (const participant of this.participants.values()) {
      if (participant.socketId === excludeSocketId) {
        continue;
      }

      for (const [producerId, producerEntry] of participant.producers.entries()) {
        producers.push({
          producerId,
          userId: participant.userId,
          fullName: participant.fullName,
          kind: producerEntry.kind,
          source: producerEntry.source,
        });
      }
    }

    return producers;
  }

  async createWebRtcTransport(socketId, direction) {
    const participant = this.getParticipant(socketId);
    if (!participant) {
      throw new ApiError(404, 'Participant is not in the room.');
    }

    const transport = await this.router.createWebRtcTransport(mediasoupConfig.transport);
    participant.addTransport(transport, direction);

    transport.on('dtlsstatechange', (state) => {
      if (state === 'closed') {
        transport.close();
      }
    });

    transport.on('close', () => {
      participant.transports.delete(transport.id);
    });

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async connectTransport(socketId, transportId, dtlsParameters) {
    const participant = this.getParticipant(socketId);
    const transport = participant?.getTransport(transportId);

    if (!transport) {
      throw new ApiError(404, 'Transport not found.');
    }

    await transport.connect({ dtlsParameters });
    return { connected: true };
  }

  async produce(socketId, { transportId, kind, rtpParameters, appData = {} }) {
    const participant = this.getParticipant(socketId);
    const transport = participant?.getTransport(transportId);

    if (!transport) {
      throw new ApiError(404, 'Transport not found for producer.');
    }

    const producer = await transport.produce({
      kind,
      rtpParameters,
      appData: {
        ...appData,
        userId: participant.userId,
        fullName: participant.fullName,
        role: participant.role,
        source: appData.source || kind,
      },
    });

    participant.addProducer(producer, {
      kind,
      source: appData.source || kind,
    });

    producer.on('transportclose', () => {
      participant.producers.delete(producer.id);
      this.manager.emitToRoom(this.meetingId, 'media:producerClosed', {
        producerId: producer.id,
        userId: participant.userId,
        kind,
        source: appData.source || kind,
      }, socketId);
    });

    producer.on('close', () => {
      participant.producers.delete(producer.id);
      this.manager.emitToRoom(this.meetingId, 'media:producerClosed', {
        producerId: producer.id,
        userId: participant.userId,
        kind,
        source: appData.source || kind,
      }, socketId);
    });

    this.manager.emitToRoom(this.meetingId, 'media:newProducer', {
      producerId: producer.id,
      userId: participant.userId,
      fullName: participant.fullName,
      kind,
      source: appData.source || kind,
    }, socketId);

    return {
      id: producer.id,
    };
  }

  async closeProducer(socketId, producerId) {
    const participant = this.getParticipant(socketId);
    if (!participant) {
      throw new ApiError(404, 'Participant not found.');
    }

    const removed = participant.closeProducer(producerId);
    if (!removed) {
      throw new ApiError(404, 'Producer not found.');
    }

    return {
      closed: true,
    };
  }

  async consume(socketId, { producerId, transportId, rtpCapabilities }) {
    const participant = this.getParticipant(socketId);
    const transport = participant?.getTransport(transportId);

    if (!participant || !transport) {
      throw new ApiError(404, 'Transport not found for consumer.');
    }

    if (!this.router.canConsume({ producerId, rtpCapabilities })) {
      throw new ApiError(400, 'Router cannot consume this producer.');
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    participant.addConsumer(consumer, {
      producerId,
      kind: consumer.kind,
    });

    consumer.on('transportclose', () => {
      participant.consumers.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
      participant.consumers.delete(consumer.id);
      this.manager.emitToSocket(socketId, 'media:producerClosed', {
        producerId,
      });
    });

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      appData: consumer.appData,
    };
  }

  async resumeConsumer(socketId, consumerId) {
    const participant = this.getParticipant(socketId);
    const consumer = participant?.getConsumer(consumerId);

    if (!consumer) {
      throw new ApiError(404, 'Consumer not found.');
    }

    await consumer.resume();
    return {
      resumed: true,
    };
  }

  updateParticipantPermissions(userId, patch) {
    const targets = this.getParticipantsByUserId(userId);
    if (targets.length === 0) {
      throw new ApiError(404, 'Target participant not found.');
    }

    const updatedPermissions = targets[0].updatePermissions(patch);

    for (const participant of targets.slice(1)) {
      participant.updatePermissions(patch);
    }

    targets.forEach((participant) => {
      this.manager.emitToSocket(participant.socketId, 'participant:permissionsUpdated', {
        userId: participant.userId,
        permissions: participant.permissions,
      });
    });

    return updatedPermissions;
  }

  closeParticipantMedia(userId, predicate) {
    const targets = this.getParticipantsByUserId(userId);
    if (targets.length === 0) {
      throw new ApiError(404, 'Target participant not found.');
    }

    const closedProducers = [];
    for (const participant of targets) {
      const removed = participant.closeMatchingProducers(predicate);
      closedProducers.push(...removed.map((producer) => ({
        producerId: producer.producerId,
        userId: participant.userId,
        kind: producer.kind,
        source: producer.source,
      })));
    }

    return closedProducers;
  }

  getTargetParticipant(userId) {
    return this.getParticipantsByUserId(userId)[0] || null;
  }

  isEmpty() {
    return this.participants.size === 0;
  }

  close() {
    const snapshots = [...this.participants.values()].map((participant) => ({
      socketId: participant.socketId,
      sessionId: participant.sessionId,
      userId: participant.userId,
      fullName: participant.fullName,
      role: participant.role,
      groupId: participant.groupId,
    }));

    for (const participant of this.participants.values()) {
      participant.closeAll();
    }

    this.participants.clear();
    this.router?.close();
    return snapshots;
  }
}
