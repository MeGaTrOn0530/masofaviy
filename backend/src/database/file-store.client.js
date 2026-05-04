import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env.js';

const dateFields = {
  userSnapshot: ['createdAt'],
  meeting: ['startTime', 'endTime', 'createdAt', 'updatedAt'],
  meetingParticipant: ['joinedAt', 'leftAt'],
  attendance: ['firstJoinedAt', 'lastLeftAt', 'createdAt', 'updatedAt'],
  chatMessage: ['createdAt'],
  attendanceSyncQueue: ['createdAt', 'updatedAt'],
};

const initialState = () => ({
  counters: {
    userSnapshot: 0,
    meeting: 0,
    meetingGroup: 0,
    meetingParticipant: 0,
    attendance: 0,
    chatMessage: 0,
    attendanceSyncQueue: 0,
  },
  userSnapshots: [],
  meetings: [],
  meetingGroups: [],
  meetingParticipants: [],
  attendance: [],
  chatMessages: [],
  attendanceSyncQueue: [],
});

const clone = (value) => structuredClone(value);

const ensureDate = (value) => {
  if (value === null || value === undefined || value instanceof Date) {
    return value;
  }

  return new Date(value);
};

const hydrateDates = (modelName, entry) => {
  if (!entry) {
    return entry;
  }

  const fields = dateFields[modelName] || [];
  const next = clone(entry);
  for (const field of fields) {
    next[field] = ensureDate(next[field]);
  }
  return next;
};

const serializeDates = (modelName, entry) => {
  const fields = dateFields[modelName] || [];
  const next = clone(entry);
  for (const field of fields) {
    if (next[field] instanceof Date) {
      next[field] = next[field].toISOString();
    }
  }
  return next;
};

const matchesScalarCondition = (value, condition) => {
  if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
    if ('in' in condition) {
      return condition.in.includes(value);
    }

    if ('lt' in condition) {
      return value < condition.lt;
    }

    if ('lte' in condition) {
      return value <= condition.lte;
    }

    if ('gt' in condition) {
      return value > condition.gt;
    }

    if ('gte' in condition) {
      return value >= condition.gte;
    }
  }

  return value === condition;
};

const applyOrderBy = (items, orderBy) => {
  if (!orderBy) {
    return items;
  }

  const [[field, direction]] = Object.entries(orderBy);
  return [...items].sort((left, right) => {
    const leftValue = left[field];
    const rightValue = right[field];

    if (leftValue < rightValue) {
      return direction === 'asc' ? -1 : 1;
    }

    if (leftValue > rightValue) {
      return direction === 'asc' ? 1 : -1;
    }

    return 0;
  });
};

class FileStoreClient {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = initialState();

    this.userSnapshot = {
      upsert: (args) => this.upsertUserSnapshot(args),
    };

    this.meeting = {
      create: (args) => this.createMeeting(args),
      findMany: (args) => this.findMeetings(args),
      findUnique: (args) => this.findUniqueMeeting(args),
      update: (args) => this.updateMeeting(args),
    };

    this.meetingParticipant = {
      create: (args) => this.createMeetingParticipant(args),
      findUnique: (args) => this.findUniqueMeetingParticipant(args),
      update: (args) => this.updateMeetingParticipant(args),
      findMany: (args) => this.findMeetingParticipants(args),
    };

    this.attendance = {
      findUnique: (args) => this.findUniqueAttendance(args),
      create: (args) => this.createAttendance(args),
      update: (args) => this.updateAttendance(args),
      findMany: (args) => this.findAttendance(args),
    };

    this.chatMessage = {
      create: (args) => this.createChatMessage(args),
      findMany: (args) => this.findChatMessages(args),
    };

    this.attendanceSyncQueue = {
      create: (args) => this.createAttendanceSyncQueue(args),
      findMany: (args) => this.findAttendanceSyncQueue(args),
      update: (args) => this.updateAttendanceSyncQueue(args),
    };
  }

  async $connect() {
    const absolutePath = path.resolve(process.cwd(), this.filePath);
    this.absolutePath = absolutePath;
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    try {
      const raw = await fs.readFile(absolutePath, 'utf8');
      this.state = JSON.parse(raw);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }

      this.state = initialState();
      await this.persist();
    }
  }

  async $disconnect() {
    await this.persist();
  }

  async $transaction(callback) {
    return callback(this);
  }

  nextId(counterName) {
    this.state.counters[counterName] += 1;
    return this.state.counters[counterName];
  }

  async persist() {
    const serializable = {
      ...this.state,
      userSnapshots: this.state.userSnapshots.map((entry) => serializeDates('userSnapshot', entry)),
      meetings: this.state.meetings.map((entry) => serializeDates('meeting', entry)),
      meetingParticipants: this.state.meetingParticipants.map((entry) => serializeDates('meetingParticipant', entry)),
      attendance: this.state.attendance.map((entry) => serializeDates('attendance', entry)),
      chatMessages: this.state.chatMessages.map((entry) => serializeDates('chatMessage', entry)),
      attendanceSyncQueue: this.state.attendanceSyncQueue.map((entry) => serializeDates('attendanceSyncQueue', entry)),
    };

    await fs.writeFile(this.absolutePath, JSON.stringify(serializable, null, 2), 'utf8');
  }

  attachMeetingGroups(meeting) {
    return {
      ...hydrateDates('meeting', meeting),
      groups: this.state.meetingGroups
        .filter((group) => group.meetingId === meeting.id)
        .map((group) => clone(group)),
    };
  }

  async upsertUserSnapshot({ where, create, update }) {
    const index = this.state.userSnapshots.findIndex((item) => item.externalUserId === where.externalUserId);
    let next;

    if (index === -1) {
      next = {
        id: this.nextId('userSnapshot'),
        createdAt: new Date(),
        ...create,
      };
      this.state.userSnapshots.push(next);
    } else {
      next = {
        ...this.state.userSnapshots[index],
        ...update,
      };
      this.state.userSnapshots[index] = next;
    }

    await this.persist();
    return hydrateDates('userSnapshot', next);
  }

  async createMeeting({ data, include }) {
    const now = new Date();
    const meeting = {
      id: this.nextId('meeting'),
      title: data.title,
      description: data.description,
      createdByUserId: data.createdByUserId,
      startTime: data.startTime,
      endTime: data.endTime,
      status: data.status || 'scheduled',
      allowCamera: data.allowCamera,
      allowMicrophone: data.allowMicrophone,
      allowScreenShare: data.allowScreenShare,
      allowChat: data.allowChat,
      createdAt: now,
      updatedAt: now,
    };

    this.state.meetings.push(meeting);

    for (const group of data.groups?.create || []) {
      this.state.meetingGroups.push({
        id: this.nextId('meetingGroup'),
        meetingId: meeting.id,
        groupId: group.groupId,
      });
    }

    await this.persist();
    return include?.groups ? this.attachMeetingGroups(meeting) : hydrateDates('meeting', meeting);
  }

  matchesMeetingWhere(meeting, where = {}) {
    if (where.OR) {
      return where.OR.some((condition) => this.matchesMeetingWhere(meeting, condition));
    }

    if (where.createdByUserId !== undefined && meeting.createdByUserId !== where.createdByUserId) {
      return false;
    }

    if (where.id !== undefined && meeting.id !== where.id) {
      return false;
    }

    if (where.groups?.some?.groupId !== undefined) {
      const hasGroup = this.state.meetingGroups.some((group) => (
        group.meetingId === meeting.id
        && matchesScalarCondition(group.groupId, where.groups.some.groupId)
      ));

      if (!hasGroup) {
        return false;
      }
    }

    return true;
  }

  async findMeetings({ where, include, orderBy } = {}) {
    const filtered = this.state.meetings.filter((meeting) => this.matchesMeetingWhere(meeting, where));
    const ordered = applyOrderBy(filtered, orderBy);

    return ordered.map((meeting) => (
      include?.groups ? this.attachMeetingGroups(meeting) : hydrateDates('meeting', meeting)
    ));
  }

  async findUniqueMeeting({ where, include }) {
    const meeting = this.state.meetings.find((item) => item.id === where.id);
    if (!meeting) {
      return null;
    }

    return include?.groups ? this.attachMeetingGroups(meeting) : hydrateDates('meeting', meeting);
  }

  async updateMeeting({ where, data, include }) {
    const index = this.state.meetings.findIndex((item) => item.id === where.id);
    if (index === -1) {
      return null;
    }

    const next = {
      ...this.state.meetings[index],
      ...data,
      updatedAt: new Date(),
    };

    this.state.meetings[index] = next;
    await this.persist();
    return include?.groups ? this.attachMeetingGroups(next) : hydrateDates('meeting', next);
  }

  async createMeetingParticipant({ data }) {
    const participant = {
      id: this.nextId('meetingParticipant'),
      joinedAt: new Date(),
      leftAt: null,
      totalSeconds: 0,
      status: 'active',
      ...data,
    };

    this.state.meetingParticipants.push(participant);
    await this.persist();
    return hydrateDates('meetingParticipant', participant);
  }

  async findUniqueMeetingParticipant({ where }) {
    const participant = this.state.meetingParticipants.find((item) => item.id === where.id);
    return hydrateDates('meetingParticipant', participant || null);
  }

  async updateMeetingParticipant({ where, data }) {
    const index = this.state.meetingParticipants.findIndex((item) => item.id === where.id);
    if (index === -1) {
      return null;
    }

    const next = {
      ...this.state.meetingParticipants[index],
      ...data,
    };

    this.state.meetingParticipants[index] = next;
    await this.persist();
    return hydrateDates('meetingParticipant', next);
  }

  matchesParticipantWhere(participant, where = {}) {
    return Object.entries(where).every(([key, condition]) => matchesScalarCondition(participant[key], condition));
  }

  async findMeetingParticipants({ where, orderBy } = {}) {
    const filtered = this.state.meetingParticipants
      .map((entry) => hydrateDates('meetingParticipant', entry))
      .filter((participant) => this.matchesParticipantWhere(participant, where));

    return applyOrderBy(filtered, orderBy);
  }

  async findUniqueAttendance({ where }) {
    const attendance = this.state.attendance.find((item) => (
      item.meetingId === where.meetingId_userId.meetingId
      && item.userId === where.meetingId_userId.userId
    ));

    return hydrateDates('attendance', attendance || null);
  }

  async createAttendance({ data }) {
    const now = new Date();
    const attendance = {
      id: this.nextId('attendance'),
      totalSeconds: 0,
      isPresent: false,
      syncedToMainBackend: false,
      createdAt: now,
      updatedAt: now,
      ...data,
    };

    this.state.attendance.push(attendance);
    await this.persist();
    return hydrateDates('attendance', attendance);
  }

  async updateAttendance({ where, data }) {
    const index = this.state.attendance.findIndex((item) => item.id === where.id);
    if (index === -1) {
      return null;
    }

    const next = {
      ...this.state.attendance[index],
      ...data,
      updatedAt: new Date(),
    };

    this.state.attendance[index] = next;
    await this.persist();
    return hydrateDates('attendance', next);
  }

  matchesAttendanceWhere(attendance, where = {}) {
    return Object.entries(where).every(([key, condition]) => matchesScalarCondition(attendance[key], condition));
  }

  async findAttendance({ where, orderBy } = {}) {
    const filtered = this.state.attendance
      .map((entry) => hydrateDates('attendance', entry))
      .filter((attendance) => this.matchesAttendanceWhere(attendance, where));

    return applyOrderBy(filtered, orderBy);
  }

  async createChatMessage({ data }) {
    const message = {
      id: this.nextId('chatMessage'),
      createdAt: new Date(),
      ...data,
    };

    this.state.chatMessages.push(message);
    await this.persist();
    return hydrateDates('chatMessage', message);
  }

  async findChatMessages({ where, orderBy, take } = {}) {
    const filtered = this.state.chatMessages
      .map((entry) => hydrateDates('chatMessage', entry))
      .filter((message) => Object.entries(where || {}).every(([key, value]) => message[key] === value));

    const ordered = applyOrderBy(filtered, orderBy);
    return take ? ordered.slice(0, take) : ordered;
  }

  async createAttendanceSyncQueue({ data }) {
    const now = new Date();
    const queueItem = {
      id: this.nextId('attendanceSyncQueue'),
      createdAt: now,
      updatedAt: now,
      ...data,
    };

    this.state.attendanceSyncQueue.push(queueItem);
    await this.persist();
    return hydrateDates('attendanceSyncQueue', queueItem);
  }

  matchesQueueWhere(queueItem, where = {}) {
    return Object.entries(where).every(([key, condition]) => {
      if (condition && typeof condition === 'object' && !Array.isArray(condition) && 'in' in condition) {
        return condition.in.includes(queueItem[key]);
      }

      if (condition && typeof condition === 'object' && !Array.isArray(condition) && 'lt' in condition) {
        return queueItem[key] < condition.lt;
      }

      return queueItem[key] === condition;
    });
  }

  async findAttendanceSyncQueue({ where, orderBy, take } = {}) {
    const filtered = this.state.attendanceSyncQueue
      .map((entry) => hydrateDates('attendanceSyncQueue', entry))
      .filter((queueItem) => this.matchesQueueWhere(queueItem, where));

    const ordered = applyOrderBy(filtered, orderBy);
    return take ? ordered.slice(0, take) : ordered;
  }

  async updateAttendanceSyncQueue({ where, data }) {
    const index = this.state.attendanceSyncQueue.findIndex((item) => item.id === where.id);
    if (index === -1) {
      return null;
    }

    const next = {
      ...this.state.attendanceSyncQueue[index],
      ...data,
      updatedAt: new Date(),
    };

    this.state.attendanceSyncQueue[index] = next;
    await this.persist();
    return hydrateDates('attendanceSyncQueue', next);
  }
}

export const createFileStoreClient = () => new FileStoreClient(env.fileStorePath);
