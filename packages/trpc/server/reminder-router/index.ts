import { TRPCError } from '@trpc/server';

import { getDocumentAndRecipientByIdOrToken } from '@documenso/lib/server-only/document/get-document-and-recipient-by-id-or-token';
import { resendDocument } from '@documenso/lib/server-only/document/resend-document';

import { adminProcedure, authenticatedProcedure, router } from '../trpc';
import {
  ZEnableRemindersQuerySchema,
  ZGetReminderHistoryQuerySchema,
  ZGetReminderStatusQuerySchema,
  ZResumeRemindersQuerySchema,
  ZStopRemindersQuerySchema,
} from './schema';

export const reminderRouter = router({
  enableReminders: authenticatedProcedure
    .input(ZEnableRemindersQuerySchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, intervalDays = 4, maxReminders = 10 } = input;
      const { user, prisma } = ctx;

      // Check document access
      const { document } = await getDocumentAndRecipientByIdOrToken({
        documentId,
        user,
        prisma,
      });

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        });
      }

      // Check if user owns document or is team member
      const canManage = document.userId === user.id || 
        (document.team && document.team.members?.some(member => member.userId === user.id));

      if (!canManage) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You cannot manage reminders for this document',
        });
      }

      // Enable reminders
      const reminder = await prisma.documentReminder.upsert({
        where: { documentId },
        update: {
          enabled: true,
          intervalDays,
          maxReminders,
          stoppedAt: null,
          stoppedReason: null,
        },
        create: {
          documentId,
          enabled: true,
          intervalDays,
          maxReminders,
        },
        include: {
          history: true,
        },
      });

      return { success: true, reminder };
    }),

  stopReminders: authenticatedProcedure
    .input(ZStopRemindersQuerySchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId, recipientId, reason = 'manual' } = input;
      const { user, prisma } = ctx;

      // Check document access
      const { document } = await getDocumentAndRecipientByIdOrToken({
        documentId,
        user,
        prisma,
      });

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        });
      }

      // Check if user owns document or is team member
      const canManage = document.userId === user.id || 
        (document.team && document.team.members?.some(member => member.userId === user.id));

      if (!canManage) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You cannot manage reminders for this document',
        });
      }

      // Create stopped reminder record
      await prisma.stoppedReminder.create({
        data: {
          documentId,
          recipientId,
          stoppedReason: reason,
          stoppedBy: 'owner',
        },
      });

      // If stopping all reminders (no specific recipient), disable the reminder
      if (!recipientId) {
        await prisma.documentReminder.update({
          where: { documentId },
          data: {
            enabled: false,
            stoppedAt: new Date(),
            stoppedReason: reason,
          },
        });
      }

      return { success: true };
    }),

  resumeReminders: authenticatedProcedure
    .input(ZResumeRemindersQuerySchema)
    .mutation(async ({ input, ctx }) => {
      const { documentId } = input;
      const { user, prisma } = ctx;

      // Check document access
      const { document } = await getDocumentAndRecipientByIdOrToken({
        documentId,
        user,
        prisma,
      });

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        });
      }

      // Check if user owns document or is team member
      const canManage = document.userId === user.id || 
        (document.team && document.team.members?.some(member => member.userId === user.id));

      if (!canManage) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You cannot manage reminders for this document',
        });
      }

      // Resume reminders
      await prisma.documentReminder.upsert({
        where: { documentId },
        update: {
          enabled: true,
          stoppedAt: null,
          stoppedReason: null,
        },
        create: {
          documentId,
          enabled: true,
          intervalDays: 4,
          maxReminders: 10,
        },
      });

      // Remove stopped reminder records for this document
      await prisma.stoppedReminder.deleteMany({
        where: { documentId },
      });

      return { success: true };
    }),

  getReminderStatus: authenticatedProcedure
    .input(ZGetReminderStatusQuerySchema)
    .query(async ({ input, ctx }) => {
      const { documentId } = input;
      const { user, prisma } = ctx;

      // Check document access
      const { document } = await getDocumentAndRecipientByIdOrToken({
        documentId,
        user,
        prisma,
      });

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        });
      }

      // Get reminder data
      const reminder = await prisma.documentReminder.findUnique({
        where: { documentId },
        include: {
          history: {
            orderBy: { sentAt: 'desc' },
            take: 1,
          },
          stopped: true,
        },
      });

      if (!reminder) {
        return {
          enabled: false,
          reminderCount: 0,
          maxReminders: 10,
          lastReminderSent: null,
          canSendReminder: false,
        };
      }

      const reminderCount = await prisma.reminderHistory.count({
        where: { documentId },
      });

      const pendingRecipients = document.recipients.filter(r => r.signingStatus !== 'SIGNED');
      const canSendReminder = reminder.enabled && 
        reminderCount < reminder.maxReminders && 
        pendingRecipients.length > 0;

      return {
        enabled: reminder.enabled,
        reminderCount,
        maxReminders: reminder.maxReminders,
        intervalDays: reminder.intervalDays,
        lastReminderSent: reminder.history[0]?.sentAt || null,
        canSendReminder,
        stoppedAt: reminder.stoppedAt,
        stoppedReason: reminder.stoppedReason,
      };
    }),

  getReminderHistory: authenticatedProcedure
    .input(ZGetReminderHistoryQuerySchema)
    .query(async ({ input, ctx }) => {
      const { documentId, limit } = input;
      const { user, prisma } = ctx;

      // Check document access
      const { document } = await getDocumentAndRecipientByIdOrToken({
        documentId,
        user,
        prisma,
      });

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        });
      }

      const history = await prisma.reminderHistory.findMany({
        where: { documentId },
        orderBy: { sentAt: 'desc' },
        take: limit,
      });

      return history.map(h => ({
        ...h,
        recipientIds: JSON.parse(h.recipientIds) as number[],
      }));
    }),
}); 