require('dotenv').config();

const config = {
  // Documenso API Configuration
  documenso: {
    baseUrl: process.env.DOCUMENSO_BASE_URL || 'https://sign.medibox.fr',
    apiToken: process.env.DOCUMENSO_API_TOKEN,
    apiVersion: 'v1'
  },

  // Reminder Settings
  reminders: {
    intervalDays: parseInt(process.env.REMINDER_INTERVAL_DAYS) || 4,
    maxReminders: parseInt(process.env.MAX_REMINDERS) || 10,
    reminderTime: process.env.REMINDER_TIME || '09:00',
    timezone: process.env.TIMEZONE || 'Europe/Paris',
    cronSchedule: process.env.CRON_SCHEDULE || '0 9 * * *' // Daily at 9 AM
  },

  // Database
  database: {
    path: process.env.DATABASE_PATH || './reminders.db'
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

// Validation
if (!config.documenso.apiToken) {
  console.error('❌ Error: DOCUMENSO_API_TOKEN is required');
  console.error('Please copy env.example to .env and add your API token');
  process.exit(1);
}

module.exports = config; 