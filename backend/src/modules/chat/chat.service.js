import { prisma } from '../../database/prisma.js';

export const chatService = {
  async createMessage({ meetingId, userId, fullName, message }) {
    return prisma.chatMessage.create({
      data: {
        meetingId,
        userId,
        fullName,
        message,
      },
    });
  },

  async getRecentMessages(meetingId, limit = 50) {
    return prisma.chatMessage.findMany({
      where: {
        meetingId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: limit,
    });
  },
};
