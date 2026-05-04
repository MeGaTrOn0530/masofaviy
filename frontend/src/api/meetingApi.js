import { apiClient } from './client.js';

export const meetingApi = {
  listDemoUsers() {
    return apiClient.get('/api/dev/users');
  },

  createDemoToken(userId) {
    return apiClient.post('/api/dev/token', { userId });
  },

  getMyMeetings(token) {
    return apiClient.get('/api/meetings/my', token);
  },

  createMeeting(payload, token) {
    return apiClient.post('/api/meetings', payload, token);
  },

  startMeeting(meetingId, token) {
    return apiClient.post(`/api/meetings/${meetingId}/start`, {}, token);
  },

  endMeeting(meetingId, token) {
    return apiClient.post(`/api/meetings/${meetingId}/end`, {}, token);
  },

  createJoinToken(meetingId, token) {
    return apiClient.post(`/api/meetings/${meetingId}/join-token`, {}, token);
  },

  getAttendance(meetingId, token) {
    return apiClient.get(`/api/meetings/${meetingId}/attendance`, token);
  },
};
