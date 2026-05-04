export class Participant {
  constructor({ socketId, sessionId, userId, fullName, role, groupId, permissions }) {
    this.socketId = socketId;
    this.sessionId = sessionId;
    this.userId = userId;
    this.fullName = fullName;
    this.role = role;
    this.groupId = groupId ?? null;
    this.permissions = { ...permissions };
    this.transports = new Map();
    this.producers = new Map();
    this.consumers = new Map();
  }

  addTransport(transport, direction) {
    this.transports.set(transport.id, {
      transport,
      direction,
    });
    return transport;
  }

  addProducer(producer, meta) {
    this.producers.set(producer.id, {
      producer,
      ...meta,
    });
    return producer;
  }

  addConsumer(consumer, meta) {
    this.consumers.set(consumer.id, {
      consumer,
      ...meta,
    });
    return consumer;
  }

  getTransport(transportId) {
    return this.transports.get(transportId)?.transport;
  }

  getProducer(producerId) {
    return this.producers.get(producerId)?.producer;
  }

  getConsumer(consumerId) {
    return this.consumers.get(consumerId)?.consumer;
  }

  updatePermissions(patch) {
    this.permissions = {
      ...this.permissions,
      ...patch,
    };
    return this.permissions;
  }

  closeProducer(producerId) {
    const producerEntry = this.producers.get(producerId);
    if (!producerEntry) {
      return null;
    }

    producerEntry.producer.close();
    this.producers.delete(producerId);
    return producerEntry;
  }

  closeMatchingProducers(predicate) {
    const removedProducers = [];

    for (const [producerId, producerEntry] of this.producers.entries()) {
      if (predicate(producerEntry)) {
        producerEntry.producer.close();
        this.producers.delete(producerId);
        removedProducers.push({
          producerId,
          ...producerEntry,
        });
      }
    }

    return removedProducers;
  }

  closeAll() {
    for (const { consumer } of this.consumers.values()) {
      consumer.close();
    }

    for (const { producer } of this.producers.values()) {
      producer.close();
    }

    for (const { transport } of this.transports.values()) {
      transport.close();
    }

    this.consumers.clear();
    this.producers.clear();
    this.transports.clear();
  }

  toPublicJSON() {
    return {
      socketId: this.socketId,
      userId: this.userId,
      fullName: this.fullName,
      role: this.role,
      groupId: this.groupId,
      permissions: this.permissions,
      producers: [...this.producers.entries()].map(([producerId, producerEntry]) => ({
        producerId,
        kind: producerEntry.kind,
        source: producerEntry.source,
      })),
    };
  }
}
