import { z } from 'zod';

export const ZEnableRemindersQuerySchema = z.object({
  documentId: z.number(),
  intervalDays: z.number().min(1).max(30).optional(),
  maxReminders: z.number().min(1).max(50).optional(),
});

export const ZStopRemindersQuerySchema = z.object({
  documentId: z.number(),
  recipientId: z.number().optional(),
  reason: z.string().optional(),
});

export const ZResumeRemindersQuerySchema = z.object({
  documentId: z.number(),
});

export const ZGetReminderStatusQuerySchema = z.object({
  documentId: z.number(),
});

export const ZGetReminderHistoryQuerySchema = z.object({
  documentId: z.number(),
  limit: z.number().min(1).max(100).optional().default(10),
});

export type TEnableRemindersQuerySchema = z.infer<typeof ZEnableRemindersQuerySchema>;
export type TStopRemindersQuerySchema = z.infer<typeof ZStopRemindersQuerySchema>;
export type TResumeRemindersQuerySchema = z.infer<typeof ZResumeRemindersQuerySchema>;
export type TGetReminderStatusQuerySchema = z.infer<typeof ZGetReminderStatusQuerySchema>;
export type TGetReminderHistoryQuerySchema = z.infer<typeof ZGetReminderHistoryQuerySchema>; 