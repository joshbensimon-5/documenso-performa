#!/bin/sh

set -x

# Run Prisma migrations first
echo "🚀 Running Prisma migrations..."
npx prisma migrate deploy --schema ../../packages/prisma/schema.prisma

echo "🌟 Starting application server..."
HOSTNAME=0.0.0.0 node build/server/main.js
