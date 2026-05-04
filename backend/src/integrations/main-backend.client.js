import ApiError from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const mockUsers = [
  { id: 1, fullName: 'Demo Teacher One', role: 'teacher', groupIds: [101, 102] },
  { id: 2, fullName: 'Demo Teacher Two', role: 'teacher', groupIds: [102] },
  { id: 3, fullName: 'Demo Admin', role: 'admin', groupIds: [] },
  { id: 1011, fullName: 'Ali Talaba', role: 'student', groupId: 101 },
  { id: 1012, fullName: 'Vali Talaba', role: 'student', groupId: 101 },
  { id: 1021, fullName: 'Zarina Talaba', role: 'student', groupId: 102 },
  { id: 1022, fullName: 'Dilnoza Talaba', role: 'student', groupId: 102 },
];

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${env.mainBackendUrl}${path}`, options);

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, `Main backend request failed: ${text || response.statusText}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

const resolveMockUser = (userId) => {
  const user = mockUsers.find((item) => item.id === Number(userId));
  if (!user) {
    throw new ApiError(401, 'Mock user not found for provided token.');
  }

  return user;
};

const toUnifiedProfile = (user) => ({
  id: user.id,
  fullName: user.fullName,
  role: user.role,
  groupId: user.groupId ?? null,
  teacherGroupIds: user.groupIds ?? [],
});

export const mainBackendClient = {
  listMockUsers() {
    return mockUsers.map(toUnifiedProfile);
  },

  async getCurrentUser(accessToken, decodedToken) {
    if (env.mainBackendMode === 'mock') {
      return toUnifiedProfile(resolveMockUser(decodedToken.userId));
    }

    const me = await requestJson('/api/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (me.role === 'teacher') {
      const groups = await requestJson(`/api/teachers/${me.id}/groups`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return {
        id: me.id,
        fullName: me.fullName,
        role: me.role,
        groupId: null,
        teacherGroupIds: Array.isArray(groups) ? groups.map((item) => item.groupId ?? item.id ?? item) : [],
      };
    }

    if (me.role === 'student') {
      const group = await requestJson(`/api/students/${me.id}/group`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return {
        id: me.id,
        fullName: me.fullName,
        role: me.role,
        groupId: group.groupId ?? group.id ?? group,
        teacherGroupIds: [],
      };
    }

    return {
      id: me.id,
      fullName: me.fullName,
      role: me.role,
      groupId: null,
      teacherGroupIds: [],
    };
  },

  async sendAttendance(payload) {
    if (env.mainBackendMode === 'mock') {
      logger.info('Attendance sync accepted by mock main backend.', payload);
      return { success: true };
    }

    return requestJson(env.mainBackendAttendancePath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Service-Key': env.mainBackendServiceKey,
      },
      body: JSON.stringify(payload),
    });
  },

  async sendMeetingEvent(type, payload) {
    if (env.mainBackendMode === 'mock') {
      logger.info(`Mock main backend received event: ${type}`, payload);
      return { success: true };
    }

    return requestJson(env.mainBackendEventPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Service-Key': env.mainBackendServiceKey,
      },
      body: JSON.stringify({
        type,
        payload,
      }),
    });
  },
};
