const sqlite3 = require('sqlite3').verbose();
const { DateTime } = require('luxon');
const config = require('./config');

class ReminderDatabase {
  constructor() {
    this.db = new sqlite3.Database(config.database.path);
    this.init();
  }

  init() {
    // Create tables if they don't exist
    this.db.serialize(() => {
      // Documents being tracked for reminders
      this.db.run(`
        CREATE TABLE IF NOT EXISTS document_reminders (
          document_id INTEGER PRIMARY KEY,
          enabled INTEGER DEFAULT 1,
          interval_days INTEGER DEFAULT 4,
          max_reminders INTEGER DEFAULT 10,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          stopped_at TEXT NULL,
          stopped_reason TEXT NULL
        )
      `);

      // Individual reminder history
      this.db.run(`
        CREATE TABLE IF NOT EXISTS reminder_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          document_id INTEGER,
          recipient_ids TEXT, -- JSON array of recipient IDs
          sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
          reminder_count INTEGER,
          success INTEGER DEFAULT 1,
          error_message TEXT NULL,
          FOREIGN KEY (document_id) REFERENCES document_reminders (document_id)
        )
      `);

      // Stopped reminders (per document or per recipient)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS stopped_reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          document_id INTEGER,
          recipient_id INTEGER NULL, -- NULL means all recipients
          stopped_at TEXT DEFAULT CURRENT_TIMESTAMP,
          stopped_reason TEXT,
          stopped_by TEXT -- 'owner', 'recipient', 'system'
        )
      `);
    });
  }

  // Add document to reminder tracking
  enableReminders(documentId, options = {}) {
    return new Promise((resolve, reject) => {
      const {
        intervalDays = config.reminders.intervalDays,
        maxReminders = config.reminders.maxReminders
      } = options;

      this.db.run(`
        INSERT OR REPLACE INTO document_reminders 
        (document_id, enabled, interval_days, max_reminders, created_at)
        VALUES (?, 1, ?, ?, ?)
      `, [documentId, intervalDays, maxReminders, DateTime.now().toISO()], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  // Stop reminders for a document
  stopReminders(documentId, recipientId = null, reason = 'manual', stoppedBy = 'owner') {
    return new Promise((resolve, reject) => {
      // Add to stopped reminders
      this.db.run(`
        INSERT INTO stopped_reminders 
        (document_id, recipient_id, stopped_reason, stopped_by)
        VALUES (?, ?, ?, ?)
      `, [documentId, recipientId, reason, stoppedBy], (err) => {
        if (err) reject(err);
        else {
          // If stopping all reminders for document, disable it
          if (!recipientId) {
            this.db.run(`
              UPDATE document_reminders 
              SET enabled = 0, stopped_at = ?, stopped_reason = ?
              WHERE document_id = ?
            `, [DateTime.now().toISO(), reason, documentId], (err) => {
              if (err) reject(err);
              else resolve();
            });
          } else {
            resolve();
          }
        }
      });
    });
  }

  // Get documents that need reminders
  getDocumentsForReminders() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          dr.*,
          COUNT(rh.id) as reminder_count,
          MAX(rh.sent_at) as last_reminder_sent
        FROM document_reminders dr
        LEFT JOIN reminder_history rh ON dr.document_id = rh.document_id
        WHERE dr.enabled = 1
        GROUP BY dr.document_id
        HAVING 
          (reminder_count = 0) OR 
          (reminder_count < dr.max_reminders AND 
           datetime(last_reminder_sent, '+' || dr.interval_days || ' days') <= datetime('now'))
      `;

      this.db.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Record that a reminder was sent
  recordReminderSent(documentId, recipientIds, reminderCount, success = true, errorMessage = null) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO reminder_history 
        (document_id, recipient_ids, reminder_count, success, error_message)
        VALUES (?, ?, ?, ?, ?)
      `, [
        documentId, 
        JSON.stringify(recipientIds), 
        reminderCount, 
        success ? 1 : 0, 
        errorMessage
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  // Check if reminders are stopped for specific document/recipient
  isReminderStopped(documentId, recipientId = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT COUNT(*) as count FROM stopped_reminders 
        WHERE document_id = ? AND (recipient_id IS NULL OR recipient_id = ?)
      `;
      
      this.db.get(query, [documentId, recipientId], (err, row) => {
        if (err) reject(err);
        else resolve(row.count > 0);
      });
    });
  }

  // Get reminder statistics
  getStats() {
    return new Promise((resolve, reject) => {
      const queries = {
        activeDocuments: `SELECT COUNT(*) as count FROM document_reminders WHERE enabled = 1`,
        totalReminders: `SELECT COUNT(*) as count FROM reminder_history WHERE success = 1`,
        stoppedDocuments: `SELECT COUNT(*) as count FROM document_reminders WHERE enabled = 0`
      };

      Promise.all([
        new Promise((res, rej) => this.db.get(queries.activeDocuments, (err, row) => err ? rej(err) : res(row.count))),
        new Promise((res, rej) => this.db.get(queries.totalReminders, (err, row) => err ? rej(err) : res(row.count))),
        new Promise((res, rej) => this.db.get(queries.stoppedDocuments, (err, row) => err ? rej(err) : res(row.count)))
      ]).then(([active, total, stopped]) => {
        resolve({ activeDocuments: active, totalReminders: total, stoppedDocuments: stopped });
      }).catch(reject);
    });
  }

  close() {
    this.db.close();
  }
}

module.exports = ReminderDatabase; 