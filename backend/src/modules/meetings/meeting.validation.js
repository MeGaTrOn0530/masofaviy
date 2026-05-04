import { z } from 'zod';

const settingsSchema = z.object({
  allowCamera: z.boolean(),
  allowMicrophone: z.boolean(),
  allowScreenShare: z.boolean(),
  allowChat: z.boolean(),
});

export const createMeetingSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(150),
    description: z.string().max(2000).optional().or(z.literal('')),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    groupIds: z.array(z.number().int().positive()).min(1),
    settings: settingsSchema,
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const meetingIdParamSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  query: z.object({}).optional(),
});

export const attendanceSyncSchema = z.object({
  body: z.object({
    meetingId: z.coerce.number().int().positive().optional(),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});
