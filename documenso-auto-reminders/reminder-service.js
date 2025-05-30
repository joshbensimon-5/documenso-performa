const { DateTime } = require('luxon');
const DocumensoAPI = require('./documenso-api');
const ReminderDatabase = require('./database');
const config = require('./config');

class ReminderService {
  constructor() {
    this.api = new DocumensoAPI();
    this.db = new ReminderDatabase();
    this.dryRun = false;
  }

  // Enable dry run mode (don't actually send emails)
  setDryRun(enabled = true) {
    this.dryRun = enabled;
    if (enabled) {
      console.log('🔍 Dry run mode enabled - no emails will be sent');
    }
  }

  // Process all pending reminders
  async processReminders() {
    try {
      console.log('🔄 Starting reminder processing...');
      
      // Health check first
      const health = await this.api.healthCheck();
      if (!health.healthy) {
        throw new Error(`API health check failed: ${health.error}. ${health.suggestion}`);
      }

      // Get documents that need reminders from our database
      const documentsToRemind = await this.db.getDocumentsForReminders();
      console.log(`📋 Found ${documentsToRemind.length} documents that may need reminders`);

      if (documentsToRemind.length === 0) {
        console.log('✅ No reminders needed at this time');
        return { processed: 0, sent: 0, errors: 0 };
      }

      let processed = 0;
      let sent = 0;
      let errors = 0;

      for (const docReminder of documentsToRemind) {
        try {
          const result = await this.processDocumentReminder(docReminder);
          processed++;
          
          if (result.sent) {
            sent++;
            console.log(`✅ Reminder sent for document ${docReminder.document_id}`);
          } else {
            console.log(`ℹ️  No reminder needed for document ${docReminder.document_id}: ${result.reason}`);
          }
        } catch (error) {
          errors++;
          console.error(`❌ Error processing document ${docReminder.document_id}:`, error.message);
        }
      }

      console.log(`\n📊 Reminder processing complete:`);
      console.log(`   • Processed: ${processed} documents`);
      console.log(`   • Reminders sent: ${sent}`);
      console.log(`   • Errors: ${errors}`);

      return { processed, sent, errors };
    } catch (error) {
      console.error('❌ Failed to process reminders:', error.message);
      throw error;
    }
  }

  // Process reminder for a specific document
  async processDocumentReminder(docReminder) {
    const documentId = docReminder.document_id;
    
    // Check if reminders are stopped for this document
    const isStopped = await this.db.isReminderStopped(documentId);
    if (isStopped) {
      return { sent: false, reason: 'Reminders stopped for this document' };
    }

    // Get current document details from Documenso
    let document;
    try {
      document = await this.api.getDocument(documentId);
    } catch (error) {
      // Document might not exist anymore
      if (error.message.includes('404') || error.message.includes('not found')) {
        await this.db.stopReminders(documentId, null, 'document_not_found', 'system');
        return { sent: false, reason: 'Document no longer exists' };
      }
      throw error;
    }

    // Check if document is still pending
    const pendingRecipients = this.api.getPendingRecipients(document);
    if (pendingRecipients.length === 0) {
      // Document is complete, stop reminders
      await this.db.stopReminders(documentId, null, 'document_completed', 'system');
      return { sent: false, reason: 'Document is fully signed' };
    }

    // Check if we've reached max reminders
    if (docReminder.reminder_count >= docReminder.max_reminders) {
      await this.db.stopReminders(documentId, null, 'max_reminders_reached', 'system');
      return { sent: false, reason: `Maximum reminders reached (${docReminder.max_reminders})` };
    }

    // Filter out recipients who have stopped reminders individually
    const activeRecipients = [];
    for (const recipientId of pendingRecipients) {
      const recipientStopped = await this.db.isReminderStopped(documentId, recipientId);
      if (!recipientStopped) {
        activeRecipients.push(recipientId);
      }
    }

    if (activeRecipients.length === 0) {
      return { sent: false, reason: 'All recipients have stopped reminders' };
    }

    // Send reminder
    const reminderCount = (docReminder.reminder_count || 0) + 1;
    
    if (this.dryRun) {
      console.log(`🔍 DRY RUN: Would send reminder #${reminderCount} for document ${documentId} to recipients: ${activeRecipients.join(', ')}`);
      await this.db.recordReminderSent(documentId, activeRecipients, reminderCount, true);
      return { sent: true, reason: 'Dry run - simulated' };
    }

    const result = await this.api.sendReminder(documentId, activeRecipients);
    
    // Record the reminder attempt
    await this.db.recordReminderSent(
      documentId, 
      activeRecipients, 
      reminderCount, 
      result.success,
      result.error
    );

    if (result.success) {
      const docInfo = this.api.formatDocumentInfo(document);
      console.log(`📧 Reminder #${reminderCount} sent for "${docInfo.title}" to ${activeRecipients.length} recipients`);
      return { sent: true, reason: `Reminder #${reminderCount} sent successfully` };
    } else {
      throw new Error(result.error);
    }
  }

  // Auto-enroll new pending documents for reminders
  async autoEnrollPendingDocuments() {
    try {
      console.log('🔍 Checking for new pending documents to enroll...');
      
      const pendingDocs = await this.api.getPendingDocuments();
      let enrolled = 0;

      for (const doc of pendingDocs) {
        // Check if already enrolled
        const documentsInDb = await this.db.getDocumentsForReminders();
        const alreadyEnrolled = documentsInDb.some(d => d.document_id === doc.id);
        
        if (!alreadyEnrolled) {
          await this.db.enableReminders(doc.id);
          enrolled++;
          const docInfo = this.api.formatDocumentInfo(doc);
          console.log(`➕ Enrolled document "${docInfo.title}" (ID: ${doc.id}) for automatic reminders`);
        }
      }

      if (enrolled === 0) {
        console.log('ℹ️  No new documents to enroll');
      } else {
        console.log(`✅ Enrolled ${enrolled} new documents for automatic reminders`);
      }

      return enrolled;
    } catch (error) {
      console.error('❌ Failed to auto-enroll documents:', error.message);
      throw error;
    }
  }

  // Get comprehensive status report
  async getStatusReport() {
    try {
      const [stats, health] = await Promise.all([
        this.db.getStats(),
        this.api.healthCheck()
      ]);

      const pendingDocs = health.healthy ? await this.api.getPendingDocuments() : [];
      
      return {
        timestamp: DateTime.now().toISO(),
        api: health,
        database: stats,
        pending: {
          documentsInDocumenso: pendingDocs.length,
          documentsTracked: stats.activeDocuments,
          needsEnrollment: Math.max(0, pendingDocs.length - stats.activeDocuments)
        },
        nextCheck: DateTime.now().plus({ hours: 24 }).toISO()
      };
    } catch (error) {
      return {
        timestamp: DateTime.now().toISO(),
        error: error.message,
        api: { healthy: false, error: error.message }
      };
    }
  }

  // Cleanup old records (optional maintenance)
  async cleanup(daysOld = 90) {
    try {
      // This would be implemented to clean up old reminder history
      console.log(`🧹 Cleanup not implemented yet (would clean records older than ${daysOld} days)`);
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
    }
  }

  close() {
    this.db.close();
  }
}

module.exports = ReminderService; 