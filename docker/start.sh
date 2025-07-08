#!/bin/sh

set -x

npx prisma migrate deploy --schema ../../packages/prisma/schema.prisma

# Fix missing customerId column if it doesn't exist
node ../../add-customer-id-column.js

HOSTNAME=0.0.0.0 node build/server/main.js
