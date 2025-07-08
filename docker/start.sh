#!/bin/sh

set -x

# Run Prisma migrations first
echo "🚀 Running Prisma migrations..."
npx prisma migrate deploy --schema ../../packages/prisma/schema.prisma

# Check migration status and fix any missing columns
echo "🔧 Checking and fixing database schema..."
node ../../add-customer-id-column.js

echo "🌟 Starting application server..."
HOSTNAME=0.0.0.0 node build/server/main.js
