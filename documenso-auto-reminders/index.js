#!/usr/bin/env node

const cron = require('node-cron');
const { DateTime } = require('luxon');
const ReminderService = require('./reminder-service');
const config = require('./config');

// Command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isSetup = args.includes('--setup');
const isStatus = args.includes('--status');
const isOneTime = args.includes('--once');
const isEnroll = args.includes('--enroll');
const isHelp = args.includes('--help') || args.includes('-h');

function showHelp() {
  console.log(`
🔔 Documenso Auto-Reminders System
==================================

Usage: node index.js [options]

Options:
  --setup         Initialize the database and test API connection
  --dry-run       Check what reminders would be sent without sending them
  --once          Run reminder check once and exit (no cron)
  --enroll        Auto-enroll pending documents for reminders
  --status        Show system status and statistics
  --help, -h      Show this help message

Default behavior:
  Runs as a scheduled service using cron (${config.reminders.cronSchedule})
  
Configuration:
  Base URL: ${config.documenso.baseUrl}
  Reminder interval: Every ${config.reminders.intervalDays} days
  Max reminders: ${config.reminders.maxReminders}
  Schedule: ${config.reminders.cronSchedule}

Examples:
  node index.js --setup           # Setup and test
  node index.js --dry-run         # See what would happen
  node index.js --once            # Run once
  node index.js --enroll --once   # Enroll new docs and exit
  node index.js                   # Start scheduled service
`);
}

async function setup() {
  console.log('🔧 Setting up Documenso Auto-Reminders...\n');
  
  const service = new ReminderService();
  
  try {
    // Test API connection
    console.log('🔗 Testing API connection...');
    const health = await service.api.healthCheck();
    
    if (health.healthy) {
      console.log('✅ API connection successful');
    } else {
      console.log('❌ API connection failed:', health.error);
      console.log('💡', health.suggestion);
      process.exit(1);
    }

    // Auto-enroll existing pending documents
    console.log('\n📋 Auto-enrolling existing pending documents...');
    const enrolled = await service.autoEnrollPendingDocuments();
    
    // Show status
    console.log('\n📊 Current status:');
    const status = await service.getStatusReport();
    console.log(JSON.stringify(status, null, 2));
    
    console.log('\n✅ Setup complete! You can now run:');
    console.log('   • npm start (start the scheduled service)');
    console.log('   • npm run check (dry run check)');
    console.log('   • npm run stop-reminders (manage reminders)');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    service.close();
  }
}

async function runOnce(dryRun = false) {
  const service = new ReminderService();
  
  try {
    if (dryRun) {
      service.setDryRun(true);
    }

    // Auto-enroll new documents if requested
    if (isEnroll) {
      await service.autoEnrollPendingDocuments();
    }

    // Process reminders
    const result = await service.processReminders();
    
    if (dryRun) {
      console.log('\n🔍 This was a dry run - no actual emails were sent');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    service.close();
  }
}

async function showStatus() {
  const service = new ReminderService();
  
  try {
    console.log('📊 Documenso Auto-Reminders Status\n');
    
    const status = await service.getStatusReport();
    
    console.log('🔗 API Status:');
    console.log(`   • Connection: ${status.api.healthy ? '✅ Healthy' : '❌ Failed'}`);
    if (!status.api.healthy) {
      console.log(`   • Error: ${status.api.error}`);
    }
    
    console.log('\n📈 Database Stats:');
    console.log(`   • Active documents: ${status.database.activeDocuments}`);
    console.log(`   • Total reminders sent: ${status.database.totalReminders}`);
    console.log(`   • Stopped documents: ${status.database.stoppedDocuments}`);
    
    console.log('\n📋 Pending Documents:');
    console.log(`   • In Documenso: ${status.pending.documentsInDocumenso}`);
    console.log(`   • Tracked for reminders: ${status.pending.documentsTracked}`);
    console.log(`   • Need enrollment: ${status.pending.needsEnrollment}`);
    
    console.log('\n⏰ Schedule:');
    console.log(`   • Cron pattern: ${config.reminders.cronSchedule}`);
    console.log(`   • Reminder interval: Every ${config.reminders.intervalDays} days`);
    console.log(`   • Max reminders per document: ${config.reminders.maxReminders}`);
    
    console.log(`\n🕒 Last checked: ${status.timestamp}`);
    
  } catch (error) {
    console.error('❌ Error getting status:', error.message);
    process.exit(1);
  } finally {
    service.close();
  }
}

async function startScheduledService() {
  console.log('🚀 Starting Documenso Auto-Reminders Service');
  console.log(`📅 Schedule: ${config.reminders.cronSchedule} (${config.reminders.timezone})`);
  console.log(`🔔 Reminder interval: Every ${config.reminders.intervalDays} days`);
  console.log(`📧 Max reminders per document: ${config.reminders.maxReminders}`);
  console.log(`🌐 Documenso URL: ${config.documenso.baseUrl}\n`);

  // Validate cron schedule
  if (!cron.validate(config.reminders.cronSchedule)) {
    console.error('❌ Invalid cron schedule:', config.reminders.cronSchedule);
    process.exit(1);
  }

  // Schedule the reminder job
  const task = cron.schedule(config.reminders.cronSchedule, async () => {
    console.log(`\n⏰ [${DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss')}] Running scheduled reminder check...`);
    
    const service = new ReminderService();
    try {
      // Auto-enroll new documents first
      await service.autoEnrollPendingDocuments();
      
      // Process reminders
      await service.processReminders();
      
    } catch (error) {
      console.error('❌ Scheduled reminder failed:', error.message);
    } finally {
      service.close();
    }
  }, {
    scheduled: true,
    timezone: config.reminders.timezone
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    task.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    task.stop();
    process.exit(0);
  });

  console.log('✅ Service started! Press Ctrl+C to stop.');
  console.log('📊 Use --status to check current status');

  // Keep the process alive
  process.stdin.resume();
}

// Main execution
async function main() {
  if (isHelp) {
    showHelp();
    return;
  }

  if (isSetup) {
    await setup();
    return;
  }

  if (isStatus) {
    await showStatus();
    return;
  }

  if (isOneTime) {
    await runOnce(isDryRun);
    return;
  }

  if (isDryRun) {
    await runOnce(true);
    return;
  }

  // Default: start scheduled service
  await startScheduledService();
}

// Run the application
main().catch(error => {
  console.error('❌ Application error:', error.message);
  process.exit(1);
}); 