#!/usr/bin/env node

const ReminderDatabase = require('./database');
const DocumensoAPI = require('./documenso-api');

// Command line arguments
const args = process.argv.slice(2);
const command = args[0];
const documentId = parseInt(args[1]);
const recipientId = args[2] ? parseInt(args[2]) : null;

function showHelp() {
  console.log(`
🛑 Stop/Resume Reminders Utility
===============================

Usage: node stop-reminders.js <command> [documentId] [recipientId]

Commands:
  list                          List all documents with reminder status
  stop <documentId>             Stop all reminders for a document
  stop <documentId> <recipientId>  Stop reminders for specific recipient
  resume <documentId>           Resume reminders for a document
  status <documentId>           Show reminder status for a document
  help                          Show this help

Examples:
  node stop-reminders.js list
  node stop-reminders.js stop 123
  node stop-reminders.js stop 123 456
  node stop-reminders.js resume 123
  node stop-reminders.js status 123
`);
}

async function listDocuments() {
  const db = new ReminderDatabase();
  const api = new DocumensoAPI();
  
  try {
    console.log('📋 Documents with Reminders\n');
    
    // Get all documents from database
    const documentsToRemind = await db.getDocumentsForReminders();
    
    if (documentsToRemind.length === 0) {
      console.log('ℹ️  No documents currently tracked for reminders');
      return;
    }

    for (const docReminder of documentsToRemind) {
      try {
        const document = await api.getDocument(docReminder.document_id);
        const docInfo = api.formatDocumentInfo(document);
        const isStopped = await db.isReminderStopped(docReminder.document_id);
        
        console.log(`📄 Document ID: ${docReminder.document_id}`);
        console.log(`   Title: "${docInfo.title}"`);
        console.log(`   Status: ${isStopped ? '🛑 Stopped' : '✅ Active'}`);
        console.log(`   Pending Recipients: ${docInfo.pendingRecipients}/${docInfo.totalRecipients}`);
        console.log(`   Reminders Sent: ${docReminder.reminder_count || 0}/${docReminder.max_reminders}`);
        console.log(`   Interval: Every ${docReminder.interval_days} days`);
        console.log('');
      } catch (error) {
        console.log(`📄 Document ID: ${docReminder.document_id}`);
        console.log(`   ❌ Error: ${error.message}`);
        console.log('');
      }
    }
  } catch (error) {
    console.error('❌ Error listing documents:', error.message);
  } finally {
    db.close();
  }
}

async function stopReminders(documentId, recipientId = null, reason = 'manual') {
  const db = new ReminderDatabase();
  
  try {
    await db.stopReminders(documentId, recipientId, reason, 'manual');
    
    if (recipientId) {
      console.log(`✅ Stopped reminders for recipient ${recipientId} in document ${documentId}`);
    } else {
      console.log(`✅ Stopped all reminders for document ${documentId}`);
    }
  } catch (error) {
    console.error('❌ Error stopping reminders:', error.message);
  } finally {
    db.close();
  }
}

async function resumeReminders(documentId) {
  const db = new ReminderDatabase();
  
  try {
    // Re-enable the document for reminders
    await db.enableReminders(documentId);
    
    // Remove from stopped reminders
    await new Promise((resolve, reject) => {
      db.db.run(`DELETE FROM stopped_reminders WHERE document_id = ?`, [documentId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log(`✅ Resumed reminders for document ${documentId}`);
  } catch (error) {
    console.error('❌ Error resuming reminders:', error.message);
  } finally {
    db.close();
  }
}

async function showDocumentStatus(documentId) {
  const db = new ReminderDatabase();
  const api = new DocumensoAPI();
  
  try {
    console.log(`📊 Reminder Status for Document ${documentId}\n`);
    
    // Get document info
    try {
      const document = await api.getDocument(documentId);
      const docInfo = api.formatDocumentInfo(document);
      
      console.log('📄 Document Info:');
      console.log(`   Title: "${docInfo.title}"`);
      console.log(`   Status: ${docInfo.status}`);
      console.log(`   Pending Recipients: ${docInfo.pendingRecipients}`);
      console.log(`   Total Recipients: ${docInfo.totalRecipients}`);
      console.log('');
      
      if (docInfo.recipients.length > 0) {
        console.log('👥 Recipients:');
        for (const recipient of docInfo.recipients) {
          const recipientStopped = await db.isReminderStopped(documentId, recipient.id);
          console.log(`   • ${recipient.name || recipient.email} (${recipient.status}) ${recipientStopped ? '🛑 Stopped' : '✅ Active'}`);
        }
        console.log('');
      }
    } catch (error) {
      console.log(`❌ Could not fetch document: ${error.message}\n`);
    }
    
    // Get reminder history
    const reminderHistory = await new Promise((resolve, reject) => {
      db.db.all(
        'SELECT * FROM reminder_history WHERE document_id = ? ORDER BY sent_at DESC LIMIT 10',
        [documentId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    if (reminderHistory.length > 0) {
      console.log('📧 Recent Reminder History:');
      for (const reminder of reminderHistory) {
        const recipients = JSON.parse(reminder.recipient_ids);
        const status = reminder.success ? '✅' : '❌';
        console.log(`   ${status} ${reminder.sent_at}: Reminder #${reminder.reminder_count} to ${recipients.length} recipients`);
        if (!reminder.success && reminder.error_message) {
          console.log(`      Error: ${reminder.error_message}`);
        }
      }
    } else {
      console.log('📧 No reminders sent yet');
    }
    
    // Check if stopped
    const isStopped = await db.isReminderStopped(documentId);
    console.log(`\n🎛️  Overall Status: ${isStopped ? '🛑 Stopped' : '✅ Active for reminders'}`);
    
  } catch (error) {
    console.error('❌ Error getting document status:', error.message);
  } finally {
    db.close();
  }
}

async function main() {
  if (!command || command === 'help') {
    showHelp();
    return;
  }

  switch (command) {
    case 'list':
      await listDocuments();
      break;
      
    case 'stop':
      if (!documentId) {
        console.error('❌ Document ID required for stop command');
        showHelp();
        return;
      }
      await stopReminders(documentId, recipientId);
      break;
      
    case 'resume':
      if (!documentId) {
        console.error('❌ Document ID required for resume command');
        showHelp();
        return;
      }
      await resumeReminders(documentId);
      break;
      
    case 'status':
      if (!documentId) {
        console.error('❌ Document ID required for status command');
        showHelp();
        return;
      }
      await showDocumentStatus(documentId);
      break;
      
    default:
      console.error(`❌ Unknown command: ${command}`);
      showHelp();
  }
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
}); 