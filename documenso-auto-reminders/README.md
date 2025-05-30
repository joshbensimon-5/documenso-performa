# 🔔 Documenso Auto-Reminders

Automatic recurring email reminders for Documenso pending signatures. 

Perfect for Medibox's document workflow - automatically sends reminders every 4 days until documents are signed, with easy controls to stop reminders when needed.

## 🌟 Features

- ✅ **Automatic recurring reminders** every 4 days (configurable)
- ✅ **Easy reminder stopping** - stop all reminders for a document or specific recipients
- ✅ **Smart enrollment** - automatically tracks new pending documents
- ✅ **Maximum reminder limits** - prevents spam (default: 10 reminders max)
- ✅ **Dry-run mode** - test what would happen without sending emails
- ✅ **Comprehensive logging** - track all reminder activity
- ✅ **Status dashboard** - monitor system health and statistics
- ✅ **Flexible scheduling** - customizable cron patterns

## 🚀 Quick Start

### 1. Setup

```bash
# Clone or extract the reminder system
cd documenso-auto-reminders

# Install dependencies
npm install

# Copy environment template
cp env.example .env

# Edit your configuration
nano .env
```

### 2. Configuration

Edit `.env` with your settings:

```env
# Your Documenso instance
DOCUMENSO_BASE_URL=https://sign.medibox.fr
DOCUMENSO_API_TOKEN=your_secret_token_here

# Reminder settings
REMINDER_INTERVAL_DAYS=4
MAX_REMINDERS=10
REMINDER_TIME=09:00
TIMEZONE=Europe/Paris

# Schedule (every day at 9 AM)
CRON_SCHEDULE=0 9 * * *
```

### 3. Initialize

```bash
# Setup database and test connection
npm run setup
```

### 4. Start the service

```bash
# Start the scheduled reminder service
npm start
```

## 📚 Usage Guide

### Basic Commands

```bash
# Test what would happen (dry run)
npm run check

# Run once and exit
node index.js --once

# Check system status
node index.js --status

# Get help
node index.js --help
```

### Managing Reminders

```bash
# List all documents with reminders
node stop-reminders.js list

# Stop all reminders for a document
node stop-reminders.js stop 123

# Stop reminders for specific recipient
node stop-reminders.js stop 123 456

# Resume reminders for a document
node stop-reminders.js resume 123

# Check detailed status for a document
node stop-reminders.js status 123
```

### Auto-enrollment

```bash
# Enroll new pending documents and exit
node index.js --enroll --once

# This happens automatically when the service runs
```

## ⚙️ Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCUMENSO_BASE_URL` | `https://sign.medibox.fr` | Your Documenso instance URL |
| `DOCUMENSO_API_TOKEN` | *required* | Your API secret token |
| `REMINDER_INTERVAL_DAYS` | `4` | Days between reminders |
| `MAX_REMINDERS` | `10` | Maximum reminders per document |
| `CRON_SCHEDULE` | `0 9 * * *` | When to check for reminders (daily at 9 AM) |
| `TIMEZONE` | `Europe/Paris` | Timezone for scheduling |
| `DATABASE_PATH` | `./reminders.db` | SQLite database location |
| `LOG_LEVEL` | `info` | Logging level |

### Cron Schedule Examples

```bash
# Every day at 9 AM
CRON_SCHEDULE="0 9 * * *"

# Every 6 hours
CRON_SCHEDULE="0 */6 * * *"

# Monday to Friday at 9 AM
CRON_SCHEDULE="0 9 * * 1-5"

# Every 2 hours during business hours (9 AM to 5 PM)
CRON_SCHEDULE="0 9-17/2 * * *"
```

## 🔧 How It Works

### 1. Document Discovery
- Automatically finds pending documents in your Documenso instance
- Enrolls new documents for reminder tracking
- Skips documents that are already completed

### 2. Reminder Logic
- Checks every document that needs a reminder (based on interval)
- Skips documents that have reached max reminders
- Respects stopped reminders (document or recipient level)
- Only sends to recipients with `PENDING` status

### 3. Smart Stopping
- Documents automatically stop when fully signed
- Manual stop controls for any document or specific recipients  
- Resume capability for accidentally stopped reminders

### 4. Reminder History
- Tracks every reminder sent (success/failure)
- Maintains count per document
- Provides audit trail for compliance

## 📊 Monitoring

### Status Dashboard

```bash
node index.js --status
```

Shows:
- ✅ API connection health
- 📈 Database statistics
- 📋 Pending document counts
- ⏰ Next scheduled check
- 🔧 Configuration summary

### Log Output

The service provides detailed logging:

```
🚀 Starting Documenso Auto-Reminders Service
📅 Schedule: 0 9 * * * (Europe/Paris)
🔔 Reminder interval: Every 4 days
📧 Max reminders per document: 10
🌐 Documenso URL: https://sign.medibox.fr

⏰ [2024-01-15 09:00:00] Running scheduled reminder check...
🔍 Checking for new pending documents to enroll...
➕ Enrolled document "Contract ABC" (ID: 123) for automatic reminders
📋 Found 5 documents that may need reminders
📧 Reminder #2 sent for "Contract ABC" to 2 recipients
✅ Reminder sent for document 123
📊 Reminder processing complete:
   • Processed: 5 documents
   • Reminders sent: 3
   • Errors: 0
```

## 🚨 Troubleshooting

### Common Issues

**API Connection Failed**
```bash
❌ API connection failed: Request failed with status code 401
💡 Check your DOCUMENSO_API_TOKEN and DOCUMENSO_BASE_URL
```
→ Verify your API token in Documenso settings

**Invalid Cron Schedule**
```bash
❌ Invalid cron schedule: 0 25 * * *
```
→ Use valid cron syntax (hour must be 0-23)

**Database Locked**
```bash
❌ Database is locked
```
→ Make sure only one instance is running

### Debug Mode

```bash
# Run with detailed logging
DEBUG=* node index.js --dry-run

# Test API connection only
node -e "
const api = require('./documenso-api');
new api().healthCheck().then(console.log);
"
```

### Reset Database

```bash
# Remove database and start fresh
rm reminders.db
npm run setup
```

## 🛠️ Advanced Usage

### Custom Reminder Intervals

You can set different intervals per document by modifying the database:

```sql
-- Set document 123 to remind every 2 days instead of 4
UPDATE document_reminders 
SET interval_days = 2 
WHERE document_id = 123;
```

### Batch Operations

```bash
# Stop reminders for multiple documents
for id in 123 124 125; do
  node stop-reminders.js stop $id
done

# Resume all stopped documents
sqlite3 reminders.db "SELECT document_id FROM document_reminders WHERE enabled = 0;" | \
while read id; do
  node stop-reminders.js resume $id
done
```

### Integration with Other Systems

The reminder system can be integrated with monitoring tools:

```bash
# Health check for monitoring
curl -f http://localhost:3000/health || exit 1

# Get statistics as JSON
node -e "
const service = require('./reminder-service');
new service().getStatusReport().then(status => {
  console.log(JSON.stringify(status));
  process.exit(0);
});
"
```

## 📝 API Reference

### Documenso API Endpoints Used

- `GET /api/v1/documents` - List all documents
- `GET /api/v1/documents/{id}` - Get document details  
- `POST /api/v1/documents/{id}/resend` - Send reminder

### Database Schema

**document_reminders**
- `document_id` - Documenso document ID
- `enabled` - Whether reminders are active
- `interval_days` - Days between reminders
- `max_reminders` - Maximum reminders to send
- `created_at` - When tracking started
- `stopped_at` - When reminders were stopped
- `stopped_reason` - Why reminders were stopped

**reminder_history**
- `document_id` - Related document
- `recipient_ids` - JSON array of recipient IDs
- `sent_at` - When reminder was sent
- `reminder_count` - Which reminder number
- `success` - Whether sending succeeded
- `error_message` - Error details if failed

**stopped_reminders**
- `document_id` - Related document
- `recipient_id` - Specific recipient (NULL = all)
- `stopped_at` - When stopped
- `stopped_reason` - Why stopped
- `stopped_by` - Who stopped it

## 🔒 Security

- Store API tokens securely (use `.env` file, not in code)
- Run with minimal required permissions
- Monitor logs for unusual activity
- Regular database backups recommended

## 🚀 Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start index.js --name "documenso-reminders"

# Setup auto-start on boot
pm2 startup
pm2 save

# Monitor
pm2 status
pm2 logs documenso-reminders
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "start"]
```

### Using Systemd

```ini
[Unit]
Description=Documenso Auto-Reminders
After=network.target

[Service]
Type=simple
User=documenso
WorkingDirectory=/path/to/documenso-auto-reminders
ExecStart=/usr/bin/node index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the logs for error details
3. Test with `--dry-run` first
4. Verify API connection with `--status`

---

**Built for Medibox** - Enhancing document workflow automation with Documenso! 🏥📄 