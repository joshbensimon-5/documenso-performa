#!/bin/sh

set -x

# Run Prisma migrations first
echo "🚀 Running Prisma migrations..."
npx prisma migrate deploy --schema ../../packages/prisma/schema.prisma

# Run comprehensive database schema migration to ensure all tables and columns exist
echo "🔧 Running comprehensive database schema migration..."
node ../../add-customer-id-column.js

echo "🌟 Starting application server..."
HOSTNAME=0.0.0.0 node build/server/main.js
